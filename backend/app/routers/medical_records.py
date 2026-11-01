from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.audit import audit
from app.db import fetch_all, fetch_one, transaction
from app.security import get_current_user, require_roles

router = APIRouter()


class CreateMedicalRecordRequest(BaseModel):
    patient_id: int
    consultation_id: Optional[int] = None
    complaint: Optional[str] = None
    diagnosis: str
    treatment: Optional[str] = None
    prescription: Optional[str] = None
    vital_bp: Optional[str] = Field(None, alias="vitalBp")
    vital_heart_rate: Optional[str] = Field(None, alias="vitalHeartRate")
    vital_temperature: Optional[str] = Field(None, alias="vitalTemperature")
    vital_resp_rate: Optional[str] = Field(None, alias="vitalRespRate")
    vital_weight: Optional[str] = Field(None, alias="vitalWeight")

    model_config = {"populate_by_name": True}


class DeleteReasonRequest(BaseModel):
    reason: Optional[str] = "Dihapus oleh dokter"


@router.get("")
async def list_medical_records(
    include_deleted: bool = Query(False),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    List rekam medis berdasarkan aturan RBAC:
    - Pasien: hanya rekam medis miliknya.
    - Dokter: hanya rekam medis yang ia buat.
    - Admin: read-only semua rekam medis.
    - Apoteker: ditolak (403).
    - Default tidak menyertakan is_deleted=true. include_deleted=true hanya untuk dokter/admin.
    """
    role = current_user["role"]
    pid = current_user.get("pid")

    if role == "apoteker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: apoteker tidak memiliki akses ke rekam medis",
        )

    where_clauses = []
    params = []

    # Filter penghapusan (soft delete)
    if role in ("dokter", "admin") and include_deleted:
        pass  # Sertakan semua
    else:
        where_clauses.append("mr.is_deleted = FALSE")

    # Filter kepemilikan berdasarkan role
    if role == "pasien":
        where_clauses.append("mr.patient_id = %s")
        params.append(pid)
    elif role == "dokter":
        where_clauses.append("mr.doctor_id = %s")
        params.append(pid)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    query = f"""
        SELECT mr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM medical_records mr
        JOIN patients p ON p.id = mr.patient_id
        JOIN doctors d ON d.id = mr.doctor_id
        {where_sql}
        ORDER BY mr.created_at DESC, mr.id DESC;
    """
    return await fetch_all(query, tuple(params))


@router.get("/deleted")
async def list_deleted_records(
    current_user: dict[str, Any] = Depends(require_roles("dokter", "admin")),
):
    """Melihat daftar rekam medis yang telah di-soft delete (hanya dokter pembuat atau admin)."""
    role = current_user["role"]
    pid = current_user.get("pid")

    if role == "dokter":
        query = """
            SELECT mr.*,
                   p.full_name AS patient_name,
                   p.nik AS patient_nik,
                   d.full_name AS doctor_name,
                   d.specialization AS doctor_specialization
            FROM medical_records mr
            JOIN patients p ON p.id = mr.patient_id
            JOIN doctors d ON d.id = mr.doctor_id
            WHERE mr.is_deleted = TRUE AND mr.doctor_id = %s
            ORDER BY mr.deleted_at DESC, mr.id DESC;
        """
        return await fetch_all(query, (pid,))
    else:  # admin
        query = """
            SELECT mr.*,
                   p.full_name AS patient_name,
                   p.nik AS patient_nik,
                   d.full_name AS doctor_name,
                   d.specialization AS doctor_specialization
            FROM medical_records mr
            JOIN patients p ON p.id = mr.patient_id
            JOIN doctors d ON d.id = mr.doctor_id
            WHERE mr.is_deleted = TRUE
            ORDER BY mr.deleted_at DESC, mr.id DESC;
        """
        return await fetch_all(query)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_medical_record(
    req: CreateMedicalRecordRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("dokter")),
):
    """
    Pembuatan rekam medis baru (hanya dokter; admin dilarang memanipulasi diagnosis).
    doctor_id dipaksa dari JWT token.
    Jika consultation_id diberikan, status konsultasi otomatis diset 'Selesai' dalam transaksi yang sama.
    """
    doctor_id = current_user.get("pid")
    if not doctor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profil dokter tidak ditemukan untuk akun ini",
        )

    diagnosis = req.diagnosis.strip() if req.diagnosis else ""
    if not diagnosis:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diagnosis wajib diisi",
        )

    # Validasi pasien ada
    patient = await fetch_one("SELECT id FROM patients WHERE id = %s;", (req.patient_id,))
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pasien tidak ditemukan",
        )

    # Transaksi atomik pembuatan medical record & penyelesaian konsultasi
    async with transaction() as conn:
        async with conn.cursor() as cur:
            if req.consultation_id:
                # Periksa apakah konsultasi valid
                await cur.execute(
                    "SELECT id FROM consultations WHERE id = %s;",
                    (req.consultation_id,),
                )
                c_row = await cur.fetchone()
                if not c_row:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Konsultasi terkait tidak ditemukan",
                    )
                # Tandai konsultasi Selesai
                await cur.execute(
                    """
                    UPDATE consultations
                    SET status = 'Selesai', updated_at = NOW()
                    WHERE id = %s;
                    """,
                    (req.consultation_id,),
                )

            await cur.execute(
                """
                INSERT INTO medical_records (
                    patient_id, doctor_id, consultation_id, complaint, diagnosis,
                    treatment, prescription, vital_bp, vital_heart_rate, vital_temperature,
                    vital_resp_rate, vital_weight, is_deleted
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                RETURNING id;
                """,
                (
                    req.patient_id,
                    doctor_id,
                    req.consultation_id,
                    req.complaint,
                    diagnosis,
                    req.treatment,
                    req.prescription,
                    req.vital_bp,
                    req.vital_heart_rate,
                    req.vital_temperature,
                    req.vital_resp_rate,
                    req.vital_weight,
                ),
            )
            mr_row = await cur.fetchone()
            created_id = mr_row["id"]

    full_record = await fetch_one(
        """
        SELECT mr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM medical_records mr
        JOIN patients p ON p.id = mr.patient_id
        JOIN doctors d ON d.id = mr.doctor_id
        WHERE mr.id = %s;
        """,
        (created_id,),
    )

    await audit(
        request=request,
        user=current_user,
        action="CREATE",
        table="medical_records",
        record_id=created_id,
        severity="info",
        details=f"Penerbitan rekam medis baru ID={created_id} untuk pasien ID={req.patient_id}.",
    )

    return full_record


@router.get("/{id}")
async def get_medical_record_detail(
    id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Melihat detail rekam medis sesuai izin akses."""
    role = current_user["role"]
    pid = current_user.get("pid")

    if role == "apoteker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: apoteker tidak memiliki akses ke rekam medis",
        )

    row = await fetch_one(
        """
        SELECT mr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM medical_records mr
        JOIN patients p ON p.id = mr.patient_id
        JOIN doctors d ON d.id = mr.doctor_id
        WHERE mr.id = %s;
        """,
        (id,),
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rekam medis tidak ditemukan",
        )

    if role == "pasien":
        if row["patient_id"] != pid or row["is_deleted"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak: bukan rekam medis milik Anda",
            )
    elif role == "dokter":
        if row["doctor_id"] != pid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak: bukan rekam medis yang Anda buat",
            )

    return row


@router.delete("/{id}")
async def soft_delete_medical_record(
    id: int,
    request: Request,
    req_body: Optional[DeleteReasonRequest] = None,
    current_user: dict[str, Any] = Depends(require_roles("dokter")),
):
    """
    Soft delete rekam medis (HANYA DOKTER PEMILIK).
    TIDAK ADA query fisik DELETE. Menyimpan timestamp deleted_at dan deleted_by.
    Audit log severity: 'danger'.
    """
    doctor_id = current_user.get("pid")
    record = await fetch_one(
        "SELECT id, doctor_id, patient_id, is_deleted FROM medical_records WHERE id = %s;",
        (id,),
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rekam medis tidak ditemukan",
        )

    if record["doctor_id"] != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: hanya dokter pembuat yang berhak melakukan soft delete rekam medis ini",
        )

    reason = req_body.reason if req_body and req_body.reason else "Dihapus oleh dokter"
    deleted_by_str = f"{current_user.get('user_name') or current_user['username']} ({reason})"

    query = """
        UPDATE medical_records
        SET is_deleted = TRUE,
            deleted_at = NOW(),
            deleted_by = %s
        WHERE id = %s;
    """
    await fetch_one("UPDATE medical_records SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE id = %s RETURNING id;", (deleted_by_str, id))

    await audit(
        request=request,
        user=current_user,
        action="DELETE",
        table="medical_records",
        record_id=id,
        severity="danger",
        details=f"Soft Delete rekam medis ID={id}: {reason}.",
    )

    return {"message": "Rekam medis berhasil di-soft delete", "id": id}


@router.patch("/{id}/restore")
async def restore_medical_record(
    id: int,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    Memulihkan rekam medis yang di-soft delete (dokter pemilik atau admin).
    Audit log action: 'RESTORE'.
    """
    role = current_user["role"]
    pid = current_user.get("pid")

    record = await fetch_one(
        "SELECT id, doctor_id, is_deleted FROM medical_records WHERE id = %s;",
        (id,),
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rekam medis tidak ditemukan",
        )

    if role == "dokter":
        if record["doctor_id"] != pid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak: hanya dokter pembuat yang dapat memulihkan rekam medis ini",
            )
    elif role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: hanya dokter pemilik atau admin yang dapat memulihkan rekam medis",
        )

    await fetch_one(
        """
        UPDATE medical_records
        SET is_deleted = FALSE,
            deleted_at = NULL,
            deleted_by = NULL
        WHERE id = %s
        RETURNING id;
        """,
        (id,),
    )

    await audit(
        request=request,
        user=current_user,
        action="RESTORE",
        table="medical_records",
        record_id=id,
        severity="warning",
        details=f"Rekam medis ID={id} berhasil dipulihkan dari status soft delete.",
    )

    return {"message": "Rekam medis berhasil dipulihkan", "id": id}

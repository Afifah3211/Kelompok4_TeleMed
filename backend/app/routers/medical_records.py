from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.audit import audit
from app.db import fetch_all, fetch_one, transaction
from app.security import get_current_user, require_roles

router = APIRouter()


class PrescriptionItemInput(BaseModel):
    medicine_id: Optional[int] = Field(None, alias="medicineId", ge=1)
    medicine_name: Optional[str] = Field(None, alias="medicineName", max_length=150)
    quantity: int = Field(..., ge=1, le=10000)
    dosage: str = Field(..., min_length=1, max_length=500)

    model_config = {"populate_by_name": True}


class CreateMedicalRecordRequest(BaseModel):
    patient_id: int
    consultation_id: Optional[int] = None
    complaint: Optional[str] = None
    diagnosis: str
    treatment: Optional[str] = None
    prescription: Optional[str] = None
    prescription_note: Optional[str] = Field(None, alias="prescriptionNote")
    prescription_items: list[PrescriptionItemInput] = Field(default_factory=list, alias="prescriptionItems")
    vital_bp: Optional[str] = Field(None, alias="vitalBp")
    vital_heart_rate: Optional[str] = Field(None, alias="vitalHeartRate")
    vital_temperature: Optional[str] = Field(None, alias="vitalTemperature")
    vital_resp_rate: Optional[str] = Field(None, alias="vitalRespRate")
    vital_weight: Optional[str] = Field(None, alias="vitalWeight")

    model_config = {"populate_by_name": True}


class DeleteReasonRequest(BaseModel):
    reason: Optional[str] = "Dihapus oleh dokter"


class UpdateMedicalRecordRequest(BaseModel):
    complaint: Optional[str] = None
    diagnosis: str
    treatment: Optional[str] = None
    prescription_note: Optional[str] = Field(None, alias="prescriptionNote")
    prescription_items: Optional[list[PrescriptionItemInput]] = Field(None, alias="prescriptionItems")
    vital_bp: Optional[str] = Field(None, alias="vitalBp")
    vital_heart_rate: Optional[str] = Field(None, alias="vitalHeartRate")
    vital_temperature: Optional[str] = Field(None, alias="vitalTemperature")
    vital_resp_rate: Optional[str] = Field(None, alias="vitalRespRate")
    vital_weight: Optional[str] = Field(None, alias="vitalWeight")

    model_config = {"populate_by_name": True}


async def resolve_prescription_items(cur, items: list[PrescriptionItemInput]):
    resolved_items = []
    prescription_lines = []

    for item in items:
        if item.medicine_id is not None:
            await cur.execute(
                "SELECT id, name, unit FROM medicines WHERE id = %s;",
                (item.medicine_id,),
            )
            medicine = await cur.fetchone()
            if not medicine:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Obat dengan ID {item.medicine_id} tidak tersedia.",
                )
            medicine_id = medicine["id"]
            medicine_name = medicine["name"]
            unit = medicine["unit"] or "unit"
        else:
            medicine_id = None
            medicine_name = (item.medicine_name or "").strip()
            unit = "unit"
            if not medicine_name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Pilih obat dari katalog atau tuliskan nama obat yang diresepkan.",
                )

        dosage = item.dosage.strip()
        if not dosage:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Aturan pakai wajib diisi untuk {medicine_name}.",
            )

        quantity = f"{item.quantity} {unit}"
        resolved_items.append({
            "medicine_id": medicine_id,
            "medicine_name": medicine_name,
            "quantity": quantity,
            "dosage": dosage,
        })
        prescription_lines.append(
            f"{medicine_name} — {quantity}; aturan pakai: {dosage}"
        )

    return resolved_items, "\n".join(prescription_lines) or None


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
    - Rekam medis terhapus hanya disertakan untuk admin yang meminta pemulihan.
    """
    role = current_user["role"]
    pid = current_user.get("pid")

    where_clauses = []
    params = []

    # Filter status penghapusan
    if role == "admin" and include_deleted:
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
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization,
               d.str_number AS doctor_sip
        FROM medical_records mr
        JOIN patients p ON p.id = mr.patient_id
        JOIN doctors d ON d.id = mr.doctor_id
        {where_sql}
        ORDER BY mr.created_at DESC, mr.id DESC;
    """
    return await fetch_all(query, tuple(params))


@router.get("/deleted")
async def list_deleted_records(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Melihat rekam medis yang dihapus untuk pemulihan admin."""
    query = """
        SELECT mr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization,
               d.str_number AS doctor_sip
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

    if req.prescription and not req.prescription_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resep harus dikirim sebagai daftar obat terstruktur, bukan teks bebas.",
        )

    # Rekam medis, resep, item obat, dan penyelesaian konsultasi harus atomik.
    created_prescription_id = None
    async with transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT id FROM patients WHERE id = %s;", (req.patient_id,))
            if not await cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Pasien tidak ditemukan",
                )

            if req.consultation_id:
                await cur.execute(
                    """
                    SELECT id, patient_id, doctor_id, status
                    FROM consultations WHERE id = %s FOR UPDATE;
                    """,
                    (req.consultation_id,),
                )
                c_row = await cur.fetchone()
                if not c_row:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Konsultasi terkait tidak ditemukan",
                    )
                if c_row["doctor_id"] != doctor_id or c_row["patient_id"] != req.patient_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Rekam medis hanya boleh dibuat untuk pasien dan konsultasi yang ditugaskan kepada dokter ini.",
                    )
                if c_row["status"] not in {"Sedang Berlangsung", "Selesai"}:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Mulai atau akhiri konsultasi terlebih dahulu sebelum menerbitkan rekam medis.",
                    )
                await cur.execute(
                    "SELECT id FROM medical_records WHERE consultation_id = %s LIMIT 1;",
                    (req.consultation_id,),
                )
                if await cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Rekam medis untuk konsultasi ini sudah pernah diterbitkan.",
                    )

            resolved_items, prescription_text = await resolve_prescription_items(
                cur, req.prescription_items
            )
            if req.consultation_id:
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
                    prescription_text,
                    req.vital_bp,
                    req.vital_heart_rate,
                    req.vital_temperature,
                    req.vital_resp_rate,
                    req.vital_weight,
                ),
            )
            mr_row = await cur.fetchone()
            created_id = mr_row["id"]

            if resolved_items:
                await cur.execute(
                    """
                    INSERT INTO prescriptions (
                        medical_record_id, consultation_id, patient_id, doctor_id,
                        status, notes
                    ) VALUES (%s, %s, %s, %s, 'Diterbitkan', %s)
                    RETURNING id;
                    """,
                    (
                        created_id,
                        req.consultation_id,
                        req.patient_id,
                        doctor_id,
                        req.prescription_note.strip() if req.prescription_note else None,
                    ),
                )
                created_prescription_id = (await cur.fetchone())["id"]
                for item in resolved_items:
                    await cur.execute(
                        """
                        INSERT INTO prescription_items (
                            prescription_id, medicine_id, medicine_name, quantity, dosage
                        ) VALUES (%s, %s, %s, %s, %s);
                        """,
                        (
                            created_prescription_id,
                            item["medicine_id"],
                            item["medicine_name"],
                            item["quantity"],
                            item["dosage"],
                        ),
                    )

    full_record = await fetch_one(
        """
        SELECT mr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization,
               d.str_number AS doctor_sip
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

    if created_prescription_id:
        await audit(
            request=request,
            user=current_user,
            action="CREATE",
            table="prescriptions",
            record_id=created_prescription_id,
            severity="info",
            details=f"Resep elektronik ID={created_prescription_id} diterbitkan untuk rekam medis ID={created_id}.",
        )

    full_record["prescription_id"] = created_prescription_id
    return full_record


@router.put("/{id}")
async def update_medical_record(
    id: int,
    req: UpdateMedicalRecordRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("dokter")),
):
    """Dokter pemilik dapat memperbarui catatan dan resep yang belum diproses."""
    doctor_id = current_user.get("pid")
    diagnosis = req.diagnosis.strip()
    if not diagnosis:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diagnosis wajib diisi",
        )

    prescription_id = None
    async with transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, patient_id, doctor_id, is_deleted, prescription
                FROM medical_records
                WHERE id = %s
                FOR UPDATE;
                """,
                (id,),
            )
            record = await cur.fetchone()
            if not record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Rekam medis tidak ditemukan",
                )
            if record["doctor_id"] != doctor_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Hanya dokter pembuat yang dapat mengubah rekam medis ini.",
                )
            if record["is_deleted"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Pulihkan rekam medis sebelum mengubah isinya.",
                )

            await cur.execute(
                """
                SELECT id, status
                FROM prescriptions
                WHERE medical_record_id = %s
                ORDER BY id DESC
                LIMIT 1
                FOR UPDATE;
                """,
                (id,),
            )
            prescription = await cur.fetchone()
            if prescription:
                prescription_id = prescription["id"]

            prescription_text = record["prescription"]
            if req.prescription_items is not None:
                resolved_items, prescription_text = await resolve_prescription_items(
                    cur, req.prescription_items
                )
                if not prescription and not resolved_items:
                    prescription_text = record["prescription"]
                if prescription and not resolved_items:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Resep yang sudah diterbitkan harus memiliki minimal satu obat.",
                    )

                if prescription:
                    await cur.execute(
                        """
                        UPDATE prescriptions
                        SET status = 'Diterbitkan',
                            notes = %s
                        WHERE id = %s;
                        """,
                        (
                            req.prescription_note.strip() if req.prescription_note else None,
                            prescription_id,
                        ),
                    )
                    await cur.execute(
                        "DELETE FROM prescription_items WHERE prescription_id = %s;",
                        (prescription_id,),
                    )
                elif resolved_items:
                    await cur.execute(
                        """
                        INSERT INTO prescriptions (
                            medical_record_id, consultation_id, patient_id, doctor_id,
                            status, notes
                        )
                        SELECT id, consultation_id, patient_id, doctor_id,
                               'Diterbitkan', %s
                        FROM medical_records
                        WHERE id = %s
                        RETURNING id;
                        """,
                        (
                            req.prescription_note.strip() if req.prescription_note else None,
                            id,
                        ),
                    )
                    prescription_id = (await cur.fetchone())["id"]

                for item in resolved_items:
                    await cur.execute(
                        """
                        INSERT INTO prescription_items (
                            prescription_id, medicine_id, medicine_name, quantity, dosage
                        ) VALUES (%s, %s, %s, %s, %s);
                        """,
                        (
                            prescription_id,
                            item["medicine_id"],
                            item["medicine_name"],
                            item["quantity"],
                            item["dosage"],
                        ),
                    )

            await cur.execute(
                """
                UPDATE medical_records
                SET complaint = %s,
                    diagnosis = %s,
                    treatment = %s,
                    prescription = %s,
                    vital_bp = %s,
                    vital_heart_rate = %s,
                    vital_temperature = %s,
                    vital_resp_rate = %s,
                    vital_weight = %s
                WHERE id = %s;
                """,
                (
                    req.complaint,
                    diagnosis,
                    req.treatment,
                    prescription_text,
                    req.vital_bp,
                    req.vital_heart_rate,
                    req.vital_temperature,
                    req.vital_resp_rate,
                    req.vital_weight,
                    id,
                ),
            )

    full_record = await fetch_one(
        """
        SELECT mr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization,
               d.str_number AS doctor_sip
        FROM medical_records mr
        JOIN patients p ON p.id = mr.patient_id
        JOIN doctors d ON d.id = mr.doctor_id
        WHERE mr.id = %s;
        """,
        (id,),
    )
    full_record["prescription_id"] = prescription_id

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table="medical_records",
        record_id=id,
        severity="info",
        details=f"Dokter memperbarui rekam medis ID={id}.",
    )
    if req.prescription_items is not None and prescription_id:
        await audit(
            request=request,
            user=current_user,
            action="UPDATE",
            table="prescriptions",
            record_id=prescription_id,
            severity="info",
            details=f"Dokter memperbarui resep ID={prescription_id} pada rekam medis ID={id}.",
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

    row = await fetch_one(
        """
        SELECT mr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization,
               d.str_number AS doctor_sip
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

    if role in {"pasien", "dokter"} and row["is_deleted"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rekam medis tidak ditemukan",
        )

    if role == "pasien":
        if row["patient_id"] != pid:
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
    Tandai rekam medis dihapus tanpa menghilangkan data yang dapat dipulihkan admin.
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
            detail="Akses ditolak: hanya dokter pembuat yang berhak menghapus rekam medis ini",
        )

    reason = req_body.reason if req_body and req_body.reason else "Dihapus oleh dokter"
    deleted_by_str = f"{current_user.get('user_name') or current_user['username']} ({reason})"

    await fetch_one("UPDATE medical_records SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE id = %s RETURNING id;", (deleted_by_str, id))

    await audit(
        request=request,
        user=current_user,
        action="DELETE",
        table="medical_records",
        record_id=id,
        severity="danger",
        details=f"Rekam medis ID={id} dihapus: {reason}.",
    )

    return {"message": "Rekam medis berhasil dihapus", "id": id}


@router.patch("/{id}/restore")
async def restore_medical_record(
    id: int,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Hanya admin yang dapat memulihkan rekam medis yang sudah dihapus.
    Audit log action: 'RESTORE'.
    """

    record = await fetch_one(
        "SELECT id, is_deleted FROM medical_records WHERE id = %s;",
        (id,),
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rekam medis tidak ditemukan",
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
        details=f"Rekam medis ID={id} berhasil dipulihkan oleh admin.",
    )

    return {"message": "Rekam medis berhasil dipulihkan", "id": id}

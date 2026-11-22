import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.audit import audit
from app.db import execute, fetch_all, fetch_one, transaction
from app.security import get_current_user, require_roles

router = APIRouter()

ALLOWED_STATUSES = {"Menunggu", "Sedang Berlangsung", "Selesai", "Dibatalkan"}
CONSULTATION_TRANSITIONS = {
    "Menunggu": {"Sedang Berlangsung", "Dibatalkan"},
    "Sedang Berlangsung": {"Selesai", "Dibatalkan"},
    "Selesai": set(),
    "Dibatalkan": set(),
}


class CreateConsultationRequest(BaseModel):
    doctor_id: int
    scheduled_at: datetime
    type: Literal["Chat", "Video Call"]
    complaint: Optional[str] = None
    notes: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: str


class DeleteConsultationRequest(BaseModel):
    reason: str = "Dihapus oleh administrator"


@router.post("/cleanup-test-data")
async def cleanup_test_consultations(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Bersihkan rekaman dummy hasil k6 load testing (admin only)."""
    from app.db import get_db_pool
    pool = await get_db_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM consultations WHERE complaint ILIKE '%k6%' OR complaint ILIKE '%load test%'"
            )
            deleted_count = cur.rowcount
    return {"message": f"Berhasil menghapus {deleted_count} data pengujian", "deleted": deleted_count}


@router.get("")
async def list_consultations(
    status_filter: Optional[str] = Query(None, alias="status"),
    patient_id_filter: Optional[int] = Query(None, alias="patient_id"),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    List konsultasi dengan filter RBAC di server:
    - Pasien: hanya konsultasi miliknya.
    - Dokter: hanya konsultasi yang ditugaskan kepadanya.
    - Admin: semua konsultasi.
    """
    role = current_user["role"]
    pid = current_user.get("pid")

    where_clauses = ["c.is_deleted = FALSE"]
    params = []

    if role == "pasien":
        where_clauses.append("c.patient_id = %s")
        params.append(pid)
        # Sembunyikan rekaman pengujian beban (k6 load test) dari pasien
        where_clauses.append("(c.complaint IS NULL OR (c.complaint NOT ILIKE %s AND c.complaint NOT ILIKE %s))")
        params.extend(["%k6%", "%load test%"])
    elif role == "dokter":
        where_clauses.append("c.doctor_id = %s")
        params.append(pid)
        # Sembunyikan rekaman pengujian beban (k6 load test) dari dokter
        where_clauses.append("(c.complaint IS NULL OR (c.complaint NOT ILIKE %s AND c.complaint NOT ILIKE %s))")
        params.extend(["%k6%", "%load test%"])
        if patient_id_filter is not None:
            where_clauses.append("c.patient_id = %s")
            params.append(patient_id_filter)
    elif role == "admin":
        if patient_id_filter is not None:
            where_clauses.append("c.patient_id = %s")
            params.append(patient_id_filter)

    if status_filter:
        where_clauses.append("c.status = %s")
        params.append(status_filter)

    where_sql = " AND ".join(where_clauses)
    query = f"""
        SELECT c.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.phone AS patient_phone,
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN doctors d ON d.id = c.doctor_id
        WHERE {where_sql}
        ORDER BY c.scheduled_at DESC, c.id DESC;
    """
    return await fetch_all(query, tuple(params))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_consultation(
    req: CreateConsultationRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("pasien")),
):
    """
    Booking konsultasi baru oleh pasien.
    patient_id dipaksa dari JWT token (current_user['pid']), bukan dari body.
    room_url dibuat otomatis oleh server.
    """
    patient_id = current_user.get("pid")
    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profil pasien tidak ditemukan untuk akun ini",
        )

    scheduled_at = req.scheduled_at
    if scheduled_at.tzinfo is None or scheduled_at.utcoffset() is None:
        raise HTTPException(status_code=400, detail="Waktu konsultasi harus menyertakan zona waktu")
    if scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Jadwal konsultasi harus berada di masa mendatang")
    if scheduled_at.minute not in {0, 30} or scheduled_at.second or scheduled_at.microsecond:
        raise HTTPException(status_code=400, detail="Jadwal konsultasi harus dimulai pada menit 00 atau 30")

    doctor = await fetch_one(
        """
        SELECT d.id FROM doctors d
        JOIN users u ON u.id = d.user_id
        WHERE d.id = %s AND u.is_active = TRUE AND u.is_deleted = FALSE;
        """,
        (req.doctor_id,),
    )
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokter yang dipilih tidak ditemukan",
        )

    room_url = f"https://meet.medisync.id/room/c{uuid.uuid4().hex[:8]}"

    async with transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT pg_advisory_xact_lock(1, %s);", (req.doctor_id,))
            await cur.execute("SELECT pg_advisory_xact_lock(2, %s);", (patient_id,))
            await cur.execute(
                """
                SELECT id, doctor_id, patient_id
                FROM consultations
                WHERE is_deleted = FALSE
                  AND status IN ('Menunggu', 'Sedang Berlangsung')
                  AND scheduled_at < %s + INTERVAL '30 minutes'
                  AND scheduled_at + INTERVAL '30 minutes' > %s
                  AND (doctor_id = %s OR patient_id = %s)
                LIMIT 1;
                """,
                (scheduled_at, scheduled_at, req.doctor_id, patient_id),
            )
            conflict = await cur.fetchone()
            if conflict:
                if conflict["doctor_id"] == req.doctor_id:
                    detail = "Dokter sudah memiliki konsultasi pada rentang waktu tersebut"
                else:
                    detail = "Anda sudah memiliki konsultasi pada rentang waktu tersebut"
                raise HTTPException(status_code=409, detail=detail)

            await cur.execute(
                """
                INSERT INTO consultations (
                    patient_id, doctor_id, scheduled_at, status, type, complaint, notes, room_url
                ) VALUES (%s, %s, %s, 'Menunggu', %s, %s, %s, %s)
                RETURNING id;
                """,
                (
                    patient_id,
                    req.doctor_id,
                    scheduled_at,
                    req.type,
                    req.complaint,
                    req.notes,
                    room_url,
                ),
            )
            row = await cur.fetchone()

    created_id = row["id"]

    full_row = await fetch_one(
        """
        SELECT c.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.phone AS patient_phone,
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN doctors d ON d.id = c.doctor_id
        WHERE c.id = %s AND c.is_deleted = FALSE;
        """,
        (created_id,),
    )

    await audit(
        request=request,
        user=current_user,
        action="CREATE",
        table="consultations",
        record_id=created_id,
        severity="info",
        details=f"Booking konsultasi baru ID={created_id} ke dokter ID={req.doctor_id}.",
    )

    return full_row


@router.get("/{id}")
async def get_consultation_detail(
    id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Melihat detail konsultasi (hanya pihak terkait atau admin)."""
    role = current_user["role"]
    pid = current_user.get("pid")

    row = await fetch_one(
        """
        SELECT c.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.phone AS patient_phone,
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN doctors d ON d.id = c.doctor_id
        WHERE c.id = %s AND c.is_deleted = FALSE;
        """,
        (id,),
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Konsultasi tidak ditemukan",
        )

    if role == "pasien" and row["patient_id"] != pid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: bukan konsultasi milik Anda",
        )
    elif role == "dokter" and row["doctor_id"] != pid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: bukan konsultasi yang ditugaskan kepada Anda",
        )

    return row


@router.patch("/{id}/status")
async def update_consultation_status(
    id: int,
    req: UpdateStatusRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    Update status konsultasi:
    - Pasien: dapat membatalkan konsultasi miliknya sebelum sesi dimulai.
    - Dokter: dapat memulai, mengakhiri, atau membatalkan konsultasi yang ditugaskan kepadanya.
    """
    new_status = req.status.strip()
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status tidak valid. Nilai yang diperbolehkan: {', '.join(sorted(ALLOWED_STATUSES))}",
        )

    consultation = await fetch_one(
        "SELECT id, patient_id, doctor_id, status FROM consultations WHERE id = %s AND is_deleted = FALSE;",
        (id,),
    )
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Konsultasi tidak ditemukan",
        )

    role = current_user["role"]
    pid = current_user.get("pid")

    if role == "pasien":
        if consultation["patient_id"] != pid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak: bukan konsultasi milik Anda",
            )
        if new_status != "Dibatalkan":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Pasien hanya diizinkan untuk membatalkan konsultasi ('Dibatalkan')",
            )
        if consultation["status"] != "Menunggu":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Konsultasi hanya dapat dibatalkan pasien sebelum dimulai.",
            )
    elif role == "dokter":
        if consultation["doctor_id"] != pid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak: bukan konsultasi yang ditugaskan kepada Anda",
            )
    elif role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: role tidak memiliki izin mengubah status",
        )

    if new_status not in CONSULTATION_TRANSITIONS.get(consultation["status"], set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Transisi konsultasi tidak valid: {consultation['status']} "
                f"tidak dapat diubah menjadi {new_status}."
            ),
        )

    query = """
        UPDATE consultations
        SET status = %s, updated_at = NOW()
        WHERE id = %s
        RETURNING *;
    """
    await fetch_one(query, (new_status, id))
    full_row = await fetch_one(
        """
        SELECT c.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.phone AS patient_phone,
               p.birth_date AS patient_birth_date,
               p.gender AS patient_gender,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN doctors d ON d.id = c.doctor_id
        WHERE c.id = %s;
        """,
        (id,),
    )

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table="consultations",
        record_id=id,
        severity="info",
        details=f"Status konsultasi ID={id} diubah dari '{consultation['status']}' menjadi '{new_status}'.",
    )

    return full_row


@router.delete("/{id}")
async def delete_consultation(
    id: int,
    req: DeleteConsultationRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    consultation = await fetch_one(
        "SELECT id, status FROM consultations WHERE id = %s AND is_deleted = FALSE;",
        (id,),
    )
    if not consultation:
        raise HTTPException(status_code=404, detail="Konsultasi tidak ditemukan")
    if consultation["status"] == "Sedang Berlangsung":
        raise HTTPException(status_code=409, detail="Konsultasi yang sedang berlangsung tidak dapat dihapus")

    reason = req.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Alasan penghapusan wajib diisi")
    await execute(
        """
        UPDATE consultations
        SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s,
            delete_reason = %s, updated_at = NOW()
        WHERE id = %s AND is_deleted = FALSE;
        """,
        (current_user["username"], reason, id),
    )
    await audit(
        request=request,
        user=current_user,
        action="DELETE",
        table="consultations",
        record_id=id,
        severity="warning",
        details=f"Konsultasi ID={id} dihapus sementara. Alasan: {reason}.",
    )
    return {"message": "Konsultasi dipindahkan ke pemulihan admin"}

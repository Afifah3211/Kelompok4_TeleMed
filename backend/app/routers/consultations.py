import uuid
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.audit import audit
from app.db import fetch_all, fetch_one
from app.security import get_current_user, require_roles

router = APIRouter()

ALLOWED_STATUSES = {"Menunggu", "Sedang Berlangsung", "Selesai", "Dibatalkan"}


class CreateConsultationRequest(BaseModel):
    doctor_id: int
    scheduled_at: datetime
    type: str = "Video Telekonsultasi"
    complaint: Optional[str] = None
    notes: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: str


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
    - Apoteker: ditolak (403).
    """
    role = current_user["role"]
    pid = current_user.get("pid")

    if role == "apoteker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: apoteker tidak memiliki akses ke konsultasi",
        )

    where_clauses = ["1=1"]
    params = []

    if role == "pasien":
        where_clauses.append("c.patient_id = %s")
        params.append(pid)
        # Sembunyikan rekaman pengujian beban (k6 load test) dari pasien
        where_clauses.append("(c.complaint IS NULL OR (c.complaint NOT ILIKE '%k6%' AND c.complaint NOT ILIKE '%load test%'))")
    elif role == "dokter":
        where_clauses.append("c.doctor_id = %s")
        params.append(pid)
        # Sembunyikan rekaman pengujian beban (k6 load test) dari dokter
        where_clauses.append("(c.complaint IS NULL OR (c.complaint NOT ILIKE '%k6%' AND c.complaint NOT ILIKE '%load test%'))")
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

    # Validasi keberadaan dokter
    doctor = await fetch_one("SELECT id FROM doctors WHERE id = %s;", (req.doctor_id,))
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokter yang dipilih tidak ditemukan",
        )

    room_url = f"https://meet.medisync.id/room/c{uuid.uuid4().hex[:8]}"

    query = """
        INSERT INTO consultations (
            patient_id, doctor_id, scheduled_at, status, type, complaint, notes, room_url
        ) VALUES (%s, %s, %s, 'Menunggu', %s, %s, %s, %s)
        RETURNING id;
    """
    row = await fetch_one(
        query,
        (
            patient_id,
            req.doctor_id,
            req.scheduled_at,
            req.type,
            req.complaint,
            req.notes,
            room_url,
        ),
    )

    created_id = row["id"]

    full_row = await fetch_one(
        """
        SELECT c.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.phone AS patient_phone,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN doctors d ON d.id = c.doctor_id
        WHERE c.id = %s;
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

    if role == "apoteker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: apoteker tidak memiliki akses ke konsultasi",
        )

    row = await fetch_one(
        """
        SELECT c.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               p.phone AS patient_phone,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN doctors d ON d.id = c.doctor_id
        WHERE c.id = %s;
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
    - Pasien: hanya boleh mengubah status ke 'Dibatalkan' untuk konsultasi miliknya.
    - Dokter: boleh mengubah status untuk konsultasi miliknya.
    - Admin: bebas mengubah status konsultasi apa pun.
    """
    new_status = req.status.strip()
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status tidak valid. Nilai yang diperbolehkan: {', '.join(sorted(ALLOWED_STATUSES))}",
        )

    consultation = await fetch_one(
        "SELECT id, patient_id, doctor_id, status FROM consultations WHERE id = %s;",
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

    query = """
        UPDATE consultations
        SET status = %s, updated_at = NOW()
        WHERE id = %s
        RETURNING *;
    """
    updated = await fetch_one(query, (new_status, id))

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table="consultations",
        record_id=id,
        severity="info",
        details=f"Status konsultasi ID={id} diubah dari '{consultation['status']}' menjadi '{new_status}'.",
    )

    return updated

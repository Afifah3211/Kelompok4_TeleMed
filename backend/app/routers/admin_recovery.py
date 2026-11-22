from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app.audit import audit
from app.db import execute, fetch_all, fetch_one
from app.security import require_roles

router = APIRouter()


@router.get("")
async def list_deleted_records(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    medical_records = await fetch_all(
        """
        SELECT mr.id, mr.patient_id, mr.doctor_id, mr.consultation_id,
               mr.diagnosis, mr.deleted_at, mr.deleted_by,
               p.full_name AS patient_name, d.full_name AS doctor_name
        FROM medical_records mr
        JOIN patients p ON p.id = mr.patient_id
        JOIN doctors d ON d.id = mr.doctor_id
        WHERE mr.is_deleted = TRUE
        ORDER BY mr.deleted_at DESC NULLS LAST, mr.id DESC;
        """
    )
    consultations = await fetch_all(
        """
        SELECT c.id, c.patient_id, c.doctor_id, c.scheduled_at, c.status,
               c.delete_reason, c.deleted_at, c.deleted_by,
               p.full_name AS patient_name, d.full_name AS doctor_name
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN doctors d ON d.id = c.doctor_id
        WHERE c.is_deleted = TRUE
        ORDER BY c.deleted_at DESC NULLS LAST, c.id DESC;
        """
    )
    users = await fetch_all(
        """
        SELECT u.id, u.username, u.role, u.delete_reason, u.deleted_at, u.deleted_by,
               COALESCE(p.full_name, d.full_name, u.username) AS full_name
        FROM users u
        LEFT JOIN patients p ON p.user_id = u.id
        LEFT JOIN doctors d ON d.user_id = u.id
        WHERE u.is_deleted = TRUE AND u.role IN ('pasien', 'dokter')
        ORDER BY u.deleted_at DESC NULLS LAST, u.id DESC;
        """
    )
    return {
        "medical_records": medical_records,
        "consultations": consultations,
        "users": users,
    }


@router.patch("/{entity}/{record_id}")
async def restore_deleted_record(
    entity: str,
    record_id: int,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    targets = {
        "medical-record": (
            "medical_records",
            "is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL",
            "is_deleted = TRUE",
        ),
        "consultation": (
            "consultations",
            "is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
            "is_deleted = TRUE",
        ),
        "user": (
            "users",
            "is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
            "is_deleted = TRUE AND role IN ('pasien', 'dokter')",
        ),
    }
    if entity not in targets:
        raise HTTPException(status_code=404, detail="Jenis data pemulihan tidak dikenal")

    table, assignments, condition = targets[entity]
    record = await fetch_one(
        f"SELECT id FROM {table} WHERE id = %s AND {condition};",
        (record_id,),
    )
    if not record:
        raise HTTPException(status_code=404, detail="Data terhapus tidak ditemukan")

    await execute(
        f"UPDATE {table} SET {assignments} WHERE id = %s;",
        (record_id,),
    )
    await audit(
        request=request,
        user=current_user,
        action="RESTORE",
        table=table,
        record_id=record_id,
        severity="success",
        details=f"Admin memulihkan data {entity} ID={record_id}.",
    )
    return {"message": "Data berhasil dipulihkan"}

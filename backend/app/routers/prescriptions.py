from typing import Any
from fastapi import APIRouter, Depends

from app.db import execute, fetch_all, transaction
from app.security import get_current_user

router = APIRouter()


async def ensure_prescription_status_schema() -> None:
    """Keep legacy statuses readable while adding the non-pharmacy prescription state."""
    async with transaction() as conn:
        await conn.execute("SELECT pg_advisory_xact_lock(620221);")
        await conn.execute(
            "ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_status_check;"
        )
        await conn.execute(
            """
            ALTER TABLE prescriptions
            ADD CONSTRAINT prescriptions_status_check
            CHECK (status IN (
                'Diterbitkan',
                'Menunggu Penyiapan',
                'Sedang Diramu',
                'Selesai / Sudah Diambil',
                'Dikembalikan ke Dokter'
            ));
            """
        )
        await conn.execute("ALTER TABLE prescriptions ALTER COLUMN status SET DEFAULT 'Diterbitkan';")


@router.get("")
async def list_prescriptions(
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    List resep obat dengan filter RBAC di server:
    - Pasien: hanya resep miliknya.
    - Dokter: hanya resep yang ia buat.
    - Admin: melihat semua resep.
    """
    role = current_user["role"]
    pid = current_user.get("pid")

    where_clauses = []
    params = []

    if role == "pasien":
        where_clauses.append("pr.patient_id = %s")
        params.append(pid)
    elif role == "dokter":
        where_clauses.append("pr.doctor_id = %s")
        params.append(pid)
    if role in {"pasien", "dokter"}:
        where_clauses.append(
            "(pr.medical_record_id IS NULL OR mr.is_deleted = FALSE)"
        )

    where_clause = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    query = f"""
        SELECT pr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM prescriptions pr
        LEFT JOIN medical_records mr ON mr.id = pr.medical_record_id
        JOIN patients p ON p.id = pr.patient_id
        JOIN doctors d ON d.id = pr.doctor_id
        {where_clause}
        ORDER BY pr.created_at DESC, pr.id DESC;
    """
    prescriptions = await fetch_all(query, tuple(params))
    if not prescriptions:
        return []

    rx_ids = [r["id"] for r in prescriptions]
    items_query = """
        SELECT id, prescription_id, medicine_id, medicine_name, quantity, dosage
        FROM prescription_items
        WHERE prescription_id = ANY(%s)
        ORDER BY id ASC;
    """
    all_items = await fetch_all(items_query, (rx_ids,))

    # Kelompokkan items berdasarkan prescription_id
    items_by_rx: dict[int, list[dict[str, Any]]] = {}
    for item in all_items:
        rx_id = item["prescription_id"]
        if rx_id not in items_by_rx:
            items_by_rx[rx_id] = []
        items_by_rx[rx_id].append(item)

    for rx in prescriptions:
        rx["items"] = items_by_rx.get(rx["id"], [])

    return prescriptions

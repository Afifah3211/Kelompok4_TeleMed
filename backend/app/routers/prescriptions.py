from typing import Any
from fastapi import APIRouter, Depends

from app.db import execute, fetch_all, transaction
from app.security import get_current_user

router = APIRouter()


async def ensure_clinical_prescription_schema() -> None:
    """Remove the retired pharmacy workflow while preserving patient prescription history."""
    async with transaction() as conn:
        await conn.execute("SELECT pg_advisory_xact_lock(620224);")

        # Pharmacist chat was never part of the supported clinical workflow.
        await conn.execute(
            """
            DELETE FROM chat_messages cm
            USING users u
            WHERE cm.sender_user_id = u.id AND u.role = 'apoteker';
            """
        )
        await conn.execute("DROP TABLE IF EXISTS pharmacists CASCADE;")
        await conn.execute("DELETE FROM users WHERE role = 'apoteker';")
        await conn.execute(
            """
            DO $$
            DECLARE role_constraint RECORD;
            BEGIN
                FOR role_constraint IN
                    SELECT conname
                    FROM pg_constraint
                    WHERE conrelid = 'users'::regclass
                      AND contype = 'c'
                      AND pg_get_constraintdef(oid) ILIKE '%apoteker%'
                LOOP
                    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', role_constraint.conname);
                END LOOP;
            END $$;
            """
        )
        await conn.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;")
        await conn.execute(
            """
            ALTER TABLE users
            ADD CONSTRAINT users_role_check
            CHECK (role IN ('admin', 'dokter', 'pasien'));
            """
        )

        # Reclassify old pharmacy processing states as a doctor-issued prescription.
        await conn.execute(
            "ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_status_check;"
        )
        await conn.execute(
            """
            UPDATE prescriptions
            SET status = 'Diterbitkan'
            WHERE status <> 'Diterbitkan';
            """
        )
        await conn.execute("ALTER TABLE prescriptions DROP COLUMN IF EXISTS pharmacist_notes;")
        # Item names are already stored as a snapshot, so remove the unused stock-catalog relation.
        await conn.execute("ALTER TABLE prescription_items DROP COLUMN IF EXISTS medicine_id;")
        await conn.execute("DROP TABLE IF EXISTS medicines CASCADE;")
        await conn.execute("ALTER TABLE prescriptions ALTER COLUMN status TYPE VARCHAR(20);")
        await conn.execute(
            """
            ALTER TABLE prescriptions
            ADD CONSTRAINT prescriptions_status_check
            CHECK (status = 'Diterbitkan');
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
        SELECT id, prescription_id, medicine_name, quantity, dosage
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

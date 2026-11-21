import re
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.audit import audit
from app.db import execute, fetch_all, fetch_one, transaction
from app.security import get_current_user, require_roles

router = APIRouter()

VALID_RX_STATUSES = {
    "Menunggu Penyiapan",
    "Sedang Diramu",
    "Selesai / Sudah Diambil",
    "Dikembalikan ke Dokter",
}
NEXT_RX_STATUS = {
    "Menunggu Penyiapan": {"Sedang Diramu", "Dikembalikan ke Dokter"},
    "Sedang Diramu": {"Selesai / Sudah Diambil", "Dikembalikan ke Dokter"},
    "Selesai / Sudah Diambil": set(),
    "Dikembalikan ke Dokter": set(),
}


async def ensure_prescription_status_schema() -> None:
    """Allow pharmacists to return an unprocessable prescription for correction."""
    await execute(
        "ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_status_check;"
    )
    await execute(
        """
        ALTER TABLE prescriptions
        ADD CONSTRAINT prescriptions_status_check
        CHECK (status IN (
            'Menunggu Penyiapan',
            'Sedang Diramu',
            'Selesai / Sudah Diambil',
            'Dikembalikan ke Dokter'
        ));
        """
    )


class UpdatePrescriptionStatusRequest(BaseModel):
    status: str
    pharmacist_notes: Optional[str] = Field(None, alias="pharmacistNotes")

    model_config = {"populate_by_name": True}


@router.get("")
async def list_prescriptions(
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    List resep obat dengan filter RBAC di server:
    - Pasien: hanya resep miliknya.
    - Dokter: hanya resep yang ia buat.
    - Admin & Apoteker: melihat semua resep.
    """
    role = current_user["role"]
    pid = current_user.get("pid")

    where_clause = ""
    params = []

    if role == "pasien":
        where_clause = "WHERE pr.patient_id = %s"
        params.append(pid)
    elif role == "dokter":
        where_clause = "WHERE pr.doctor_id = %s"
        params.append(pid)

    query = f"""
        SELECT pr.*,
               p.full_name AS patient_name,
               p.nik AS patient_nik,
               d.full_name AS doctor_name,
               d.specialization AS doctor_specialization
        FROM prescriptions pr
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


@router.patch("/{id}/status")
async def update_prescription_status(
    id: int,
    req: UpdatePrescriptionStatusRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("apoteker")),
):
    """
    Update status resep obat (khusus apoteker).
    Validasi status: 'Menunggu Penyiapan', 'Sedang Diramu', 'Selesai / Sudah Diambil'.
    Stok dikurangi ketika resep benar-benar ditandai sudah diserahkan.
    Tolak bila stok tidak mencukupi.
    """
    new_status = req.status.strip()
    if new_status not in VALID_RX_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status tidak valid. Nilai yang diperbolehkan: {', '.join(sorted(VALID_RX_STATUSES))}",
        )

    async with transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT * FROM prescriptions WHERE id = %s FOR UPDATE;", (id,))
            rx = await cur.fetchone()
            if not rx:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Resep obat tidak ditemukan",
                )

            if new_status not in NEXT_RX_STATUS.get(rx["status"], set()):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Transisi status tidak valid: {rx['status']} tidak dapat diubah menjadi {new_status}.",
                )

            # Jika berubah menjadi 'Selesai / Sudah Diambil', kurangi stok obat
            if new_status == "Selesai / Sudah Diambil" and rx["status"] != "Selesai / Sudah Diambil":
                await cur.execute(
                    "SELECT * FROM prescription_items WHERE prescription_id = %s;",
                    (id,),
                )
                items = await cur.fetchall()

                for it in items:
                    # Ambil angka kuantitas yang dibutuhkan
                    qty_str = it.get("quantity") or ""
                    match = re.search(r"\d+", qty_str)
                    qty_needed = int(match.group(0)) if match else 1

                    # Cari obat di tabel medicines
                    med = None
                    if it.get("medicine_id"):
                        await cur.execute(
                            "SELECT id, name, stock FROM medicines WHERE id = %s FOR UPDATE;",
                            (it["medicine_id"],),
                        )
                        med = await cur.fetchone()

                    if not med and it.get("medicine_name"):
                        await cur.execute(
                            "SELECT id, name, stock FROM medicines WHERE name ILIKE %s FOR UPDATE;",
                            (it["medicine_name"].strip(),),
                        )
                        med = await cur.fetchone()

                    if not med:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Obat '{it.get('medicine_name')}' tidak terhubung ke katalog stok; stok tidak dapat dipotong.",
                        )
                    if med["stock"] < qty_needed:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                f"Stok obat '{med['name']}' tidak mencukupi "
                                f"(tersedia: {med['stock']}, dibutuhkan: {qty_needed})"
                            ),
                        )
                    # Kurangi stok hanya ketika apoteker menyelesaikan penyerahan.
                    await cur.execute(
                        "UPDATE medicines SET stock = stock - %s WHERE id = %s;",
                        (qty_needed, med["id"]),
                    )

            await cur.execute(
                """
                UPDATE prescriptions
                SET status = %s,
                    pharmacist_notes = COALESCE(%s, pharmacist_notes)
                WHERE id = %s
                RETURNING *;
                """,
                (new_status, req.pharmacist_notes.strip() if req.pharmacist_notes else None, id),
            )
            updated_rx = await cur.fetchone()

    items = await fetch_all(
        "SELECT id, prescription_id, medicine_id, medicine_name, quantity, dosage FROM prescription_items WHERE prescription_id = %s ORDER BY id ASC;",
        (id,),
    )
    updated_rx["items"] = items

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table="prescriptions",
        record_id=id,
        severity="info",
        details=f"Apoteker mengubah status resep ID={id} menjadi '{new_status}'.",
    )

    return updated_rx

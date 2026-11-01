from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.audit import audit
from app.db import fetch_all, fetch_one
from app.security import require_roles

router = APIRouter()


class UpdateMedicineRequest(BaseModel):
    stock: Optional[int] = None
    price: Optional[float] = None
    name: Optional[str] = None
    category: Optional[str] = None
    form: Optional[str] = None
    unit: Optional[str] = None
    dosage: Optional[str] = None
    description: Optional[str] = None


@router.get("")
async def list_medicines(
    current_user: dict[str, Any] = Depends(require_roles("dokter", "admin", "apoteker")),
):
    """Melihat daftar master data obat (dokter, admin, dan apoteker)."""
    query = """
        SELECT id, code, name, category, form, stock, unit, price, dosage, description
        FROM medicines
        ORDER BY name ASC;
    """
    return await fetch_all(query)


@router.put("/{id}")
async def update_medicine(
    id: int,
    req: UpdateMedicineRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("apoteker")),
):
    """
    Update data obat, stok, dan harga (khusus apoteker).
    Validasi: stok tidak boleh bernilai negatif.
    Audit log action: 'UPDATE'.
    """
    if req.stock is not None and req.stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stok obat tidak boleh bernilai negatif",
        )

    if req.price is not None and req.price < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Harga obat tidak boleh bernilai negatif",
        )

    current_med = await fetch_one("SELECT * FROM medicines WHERE id = %s;", (id,))
    if not current_med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data obat tidak ditemukan",
        )

    query = """
        UPDATE medicines
        SET stock = COALESCE(%s, stock),
            price = COALESCE(%s, price),
            name = COALESCE(%s, name),
            category = COALESCE(%s, category),
            form = COALESCE(%s, form),
            unit = COALESCE(%s, unit),
            dosage = COALESCE(%s, dosage),
            description = COALESCE(%s, description)
        WHERE id = %s
        RETURNING *;
    """
    updated = await fetch_one(
        query,
        (
            req.stock,
            req.price,
            req.name.strip() if req.name else None,
            req.category.strip() if req.category else None,
            req.form.strip() if req.form else None,
            req.unit.strip() if req.unit else None,
            req.dosage.strip() if req.dosage else None,
            req.description.strip() if req.description else None,
            id,
        ),
    )

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table="medicines",
        record_id=id,
        severity="info",
        details=(
            f"Apoteker memperbarui obat '{updated['name']}' (ID={id}): "
            f"stok={updated['stock']}, harga={updated['price']}."
        ),
    )

    return updated

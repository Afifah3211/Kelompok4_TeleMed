from datetime import date
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.audit import audit
from app.db import execute, fetch_all, fetch_one, transaction
from app.security import (
    get_current_user,
    hash_password,
    require_roles,
)

router = APIRouter()


class CreateDoctorRequest(BaseModel):
    username: str
    password: str
    fullName: str
    specialization: Optional[str] = None
    strNumber: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    fullName: Optional[str] = None
    nik: Optional[str] = None
    birthDate: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bloodType: Optional[str] = None
    allergies: Optional[str] = None
    specialization: Optional[str] = None
    strNumber: Optional[str] = None
    sipaNumber: Optional[str] = None
    workplace: Optional[str] = None


@router.get("")
async def list_users(
    role: Optional[str] = Query(None),
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """List semua user (khusus admin, tanpa password_hash)."""
    if role:
        query = "SELECT id, username, role, is_active, created_at FROM users WHERE role = %s ORDER BY id ASC;"
        rows = await fetch_all(query, (role,))
    else:
        query = "SELECT id, username, role, is_active, created_at FROM users ORDER BY id ASC;"
        rows = await fetch_all(query)
    return rows


@router.get("/doctors")
async def list_doctors(
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """List semua dokter beserta profil (dapat diakses oleh semua role yang login)."""
    query = """
        SELECT u.id AS user_id, u.username, u.is_active, u.created_at,
               d.id, d.full_name, d.specialization, d.str_number
        FROM users u
        JOIN doctors d ON d.user_id = u.id
        WHERE u.role = 'dokter'
        ORDER BY d.full_name ASC;
    """
    return await fetch_all(query)


@router.get("/patients")
async def list_patients(
    current_user: dict[str, Any] = Depends(require_roles("admin", "dokter", "apoteker")),
):
    """List semua pasien beserta profil (khusus dokter, admin, dan apoteker)."""
    query = """
        SELECT u.id AS user_id, u.username, u.is_active, u.created_at,
               p.id, p.nik, p.full_name, p.birth_date, p.gender, p.phone, p.address,
               p.blood_type, p.allergies
        FROM users u
        JOIN patients p ON p.user_id = u.id
        WHERE u.role = 'pasien'
        ORDER BY p.full_name ASC;
    """
    return await fetch_all(query)


@router.post("/doctor", status_code=status.HTTP_201_CREATED)
async def create_doctor(
    req: CreateDoctorRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Admin membuat akun dokter dan profil dokter dalam satu transaksi."""
    username = req.username.strip()
    full_name = req.fullName.strip()
    if not username or not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username dan nama dokter wajib diisi",
        )

    if len(req.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password dokter minimal 8 karakter",
        )

    exists = await fetch_one("SELECT id FROM users WHERE username = %s", (username,))
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username sudah terdaftar",
        )

    hashed_pwd = await hash_password(req.password)

    async with transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO users (username, password_hash, role, is_active)
                VALUES (%s, %s, 'dokter', TRUE)
                RETURNING id, username, role, is_active, created_at;
                """,
                (username, hashed_pwd),
            )
            user_row = await cur.fetchone()
            user_id = user_row["id"]

            await cur.execute(
                """
                INSERT INTO doctors (user_id, full_name, specialization, str_number)
                VALUES (%s, %s, %s, %s)
                RETURNING id, user_id, full_name, specialization, str_number;
                """,
                (
                    user_id,
                    full_name,
                    req.specialization.strip() if req.specialization else None,
                    req.strNumber.strip() if req.strNumber else None,
                ),
            )
            doctor_row = await cur.fetchone()

    await audit(
        request=request,
        user=current_user,
        action="CREATE",
        table="users",
        record_id=user_id,
        severity="success",
        details=f"Admin menambahkan akun dokter: {full_name} ({username}).",
    )

    return {"user": user_row, "doctor": doctor_row}


@router.patch("/{id}/toggle")
@router.patch("/{id}/toggle-status")
async def toggle_user_active(
    id: int,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Admin mengaktifkan atau menonaktifkan akun user."""
    user = await fetch_one("SELECT id, username, role, is_active FROM users WHERE id = %s", (id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan",
        )

    new_status = not user["is_active"]
    await execute("UPDATE users SET is_active = %s WHERE id = %s", (new_status, id))

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table="users",
        record_id=id,
        severity="warning",
        details=f"Status keaktifan user '{user['username']}' diubah menjadi {new_status}.",
    )

    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "is_active": new_status,
    }


@router.put("/{id}")
async def update_user_profile(
    id: int,
    req: UpdateProfileRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Update data profil pengguna (hanya bisa diubah oleh diri sendiri atau admin)."""
    if current_user["role"] != "admin" and current_user["id"] != id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tidak memiliki izin untuk mengubah profil pengguna lain",
        )

    user = await fetch_one("SELECT id, username, role FROM users WHERE id = %s", (id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan",
        )

    role = user["role"]
    if role == "pasien":
        await execute(
            """
            UPDATE patients
            SET full_name = COALESCE(%s, full_name),
                nik = COALESCE(%s, nik),
                birth_date = COALESCE(%s, birth_date),
                gender = COALESCE(%s, gender),
                phone = COALESCE(%s, phone),
                address = COALESCE(%s, address),
                blood_type = COALESCE(%s, blood_type),
                allergies = COALESCE(%s, allergies)
            WHERE user_id = %s;
            """,
            (
                req.fullName.strip() if req.fullName else None,
                req.nik.strip() if req.nik else None,
                req.birthDate,
                req.gender,
                req.phone.strip() if req.phone else None,
                req.address.strip() if req.address else None,
                req.bloodType.strip() if req.bloodType else None,
                req.allergies.strip() if req.allergies else None,
                id,
            ),
        )
    elif role == "dokter":
        await execute(
            """
            UPDATE doctors
            SET full_name = COALESCE(%s, full_name),
                specialization = COALESCE(%s, specialization),
                str_number = COALESCE(%s, str_number)
            WHERE user_id = %s;
            """,
            (
                req.fullName.strip() if req.fullName else None,
                req.specialization.strip() if req.specialization else None,
                req.strNumber.strip() if req.strNumber else None,
                id,
            ),
        )
    elif role == "apoteker":
        await execute(
            """
            UPDATE pharmacists
            SET full_name = COALESCE(%s, full_name),
                sipa_number = COALESCE(%s, sipa_number),
                workplace = COALESCE(%s, workplace)
            WHERE user_id = %s;
            """,
            (
                req.fullName.strip() if req.fullName else None,
                req.sipaNumber.strip() if req.sipaNumber else None,
                req.workplace.strip() if req.workplace else None,
                id,
            ),
        )

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table="users",
        record_id=id,
        severity="info",
        details=f"Profil user {user['username']} (ID={id}) berhasil diperbarui.",
    )

    return {"message": "Profil berhasil diperbarui"}

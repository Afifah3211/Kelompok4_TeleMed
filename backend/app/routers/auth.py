from datetime import date
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.audit import audit
from app.db import execute, fetch_one, transaction
from app.limiter import limiter
from app.normalization import normalize_gender
from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    fullName: str
    nik: Optional[str] = None
    birthDate: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bloodType: Optional[str] = None
    allergies: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    oldPassword: str
    newPassword: str


class ForgotPasswordRequest(BaseModel):
    username: str
    nik: str
    birthDate: date
    newPassword: str


@router.post("/login")
@limiter.limit("30/minute")
async def login(req: LoginRequest, request: Request):
    """Login dengan username dan password; mengembalikan JWT token, user info, dan profil."""
    if not req.username or not req.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username dan password wajib diisi",
        )

    user = await fetch_one(
        "SELECT id, username, password_hash, role, is_active FROM users WHERE username = %s",
        (req.username.strip(),),
    )

    if not user or not await verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun dinonaktifkan. Silakan hubungi administrator",
        )

    profile = None
    role = user["role"]
    if role == "pasien":
        profile = await fetch_one("SELECT * FROM patients WHERE user_id = %s", (user["id"],))
    elif role == "dokter":
        profile = await fetch_one("SELECT * FROM doctors WHERE user_id = %s", (user["id"],))
    elif role == "apoteker":
        profile = await fetch_one("SELECT * FROM pharmacists WHERE user_id = %s", (user["id"],))

    pid = profile["id"] if profile else None
    token = create_access_token(user_id=user["id"], role=role, pid=pid)

    await audit(
        request=request,
        user=user,
        action="LOGIN",
        table="users",
        record_id=user["id"],
        severity="info",
        details=f"Login berhasil sebagai {role}.",
    )

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
        },
        "profile": profile,
    }


@router.get("/me")
async def get_current_user_profile(
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Mendapatkan data akun dan profil pengguna aktif dari JWT token."""
    user = await fetch_one(
        "SELECT id, username, role, is_active, created_at FROM users WHERE id = %s",
        (current_user["id"],),
    )
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")

    profile = None
    role = user["role"]
    if role == "pasien":
        profile = await fetch_one("SELECT * FROM patients WHERE user_id = %s", (user["id"],))
    elif role == "dokter":
        profile = await fetch_one("SELECT * FROM doctors WHERE user_id = %s", (user["id"],))
    elif role == "apoteker":
        profile = await fetch_one("SELECT * FROM pharmacists WHERE user_id = %s", (user["id"],))

    return {
        "user": user,
        "profile": profile,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, request: Request):
    """Registrasi mandiri khusus pasien baru."""
    username = req.username.strip()
    if not username or not req.fullName.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username dan nama lengkap wajib diisi",
        )

    if len(req.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password minimal 8 karakter",
        )

    gender = normalize_gender(req.gender)
    if req.gender and req.gender.strip() != "-" and gender is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jenis kelamin harus Laki-laki atau Perempuan",
        )

    existing_user = await fetch_one("SELECT id FROM users WHERE username = %s", (username,))
    if existing_user:
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
                VALUES (%s, %s, 'pasien', TRUE)
                RETURNING id, username, role, is_active, created_at;
                """,
                (username, hashed_pwd),
            )
            user_row = await cur.fetchone()
            user_id = user_row["id"]

            await cur.execute(
                """
                INSERT INTO patients (user_id, nik, full_name, birth_date, gender, phone, address, blood_type, allergies)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, user_id, nik, full_name, birth_date, gender, phone, address, blood_type, allergies;
                """,
                (
                    user_id,
                    req.nik.strip() if req.nik else None,
                    req.fullName.strip(),
                    req.birthDate,
                    gender,
                    req.phone,
                    req.address,
                    req.bloodType,
                    req.allergies,
                ),
            )
            patient_row = await cur.fetchone()

    await audit(
        request=request,
        user={"id": user_id, "username": username},
        action="CREATE",
        table="users",
        record_id=user_id,
        severity="success",
        details=f"Registrasi pasien baru: {req.fullName.strip()}.",
    )

    return {
        "message": "Registrasi berhasil",
        "user": {
            "id": user_row["id"],
            "username": user_row["username"],
            "role": user_row["role"],
        },
        "profile": patient_row,
    }


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Ganti password untuk user yang sedang login."""
    if len(req.newPassword) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password baru minimal 8 karakter",
        )

    user = await fetch_one(
        "SELECT password_hash FROM users WHERE id = %s",
        (current_user["id"],),
    )
    if not user or not await verify_password(req.oldPassword, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password lama tidak sesuai",
        )

    new_hash = await hash_password(req.newPassword)
    await execute(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (new_hash, current_user["id"]),
    )

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table="users",
        record_id=current_user["id"],
        severity="info",
        details="Pengguna berhasil memperbarui password akun.",
    )

    return {"message": "Password berhasil diperbarui"}


@router.post("/forgot-password")
@limiter.limit("30/minute")
async def forgot_password(req: ForgotPasswordRequest, request: Request):
    """Reset password mandiri pasien dengan verifikasi identitas (NIK dan tanggal lahir)."""
    if len(req.newPassword) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password baru minimal 8 karakter",
        )

    user = await fetch_one(
        """
        SELECT u.id, u.username, u.role, u.is_active, p.nik, p.birth_date
        FROM users u
        LEFT JOIN patients p ON p.user_id = u.id
        WHERE u.username = %s;
        """,
        (req.username.strip(),),
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Akun dengan username tersebut tidak ditemukan",
        )

    if user["role"] != "pasien":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reset password mandiri hanya diizinkan untuk pasien. Staf/dokter silakan hubungi admin.",
        )

    db_nik = (user.get("nik") or "").strip()
    db_birth = str(user.get("birth_date") or "").strip()
    req_nik = req.nik.strip()
    req_birth = str(req.birthDate).strip()

    if not db_nik or db_nik != req_nik or db_birth != req_birth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verifikasi gagal: NIK atau tanggal lahir tidak cocok dengan data terdaftar",
        )

    new_hash = await hash_password(req.newPassword)
    await execute(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (new_hash, user["id"]),
    )

    await audit(
        request=request,
        user={"id": user["id"], "username": user["username"]},
        action="UPDATE",
        table="users",
        record_id=user["id"],
        severity="warning",
        details="Reset password akun pasien via verifikasi identitas diri (NIK & tanggal lahir).",
    )

    return {"message": "Password berhasil diperbarui. Silakan login kembali."}

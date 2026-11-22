from datetime import date
import logging
from typing import Any, Optional
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel

from app.audit import audit
from app.config import settings
from app.db import execute, fetch_all, fetch_one, transaction
from app.routers.files import _ensure_bucket, _profile_photo_url, _s3_client
from app.normalization import normalize_gender
from app.security import (
    get_current_user,
    hash_password,
    require_roles,
)

router = APIRouter()
logger = logging.getLogger("telemed.users")
PROFILE_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024


async def ensure_profile_recovery_schema():
    """Apply additive columns needed by existing database volumes."""
    async with transaction() as conn:
        await conn.execute("SELECT pg_advisory_xact_lock(620221);")
        for statement in (
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(150);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS delete_reason TEXT;",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS profile_photo_key VARCHAR(512);",
            "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS phone VARCHAR(30);",
            "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS workplace VARCHAR(150);",
            "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_photo_key VARCHAR(512);",
            "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;",
            "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(150);",
            "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS delete_reason TEXT;",
            "CREATE INDEX IF NOT EXISTS idx_consult_deleted ON consultations(is_deleted);",
        ):
            await conn.execute(statement)


class CreateDoctorRequest(BaseModel):
    username: str
    password: str
    fullName: str
    specialization: Optional[str] = None
    strNumber: Optional[str] = None
    phone: Optional[str] = None
    workplace: Optional[str] = None


class CreatePatientRequest(BaseModel):
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
    workplace: Optional[str] = None


class DeleteUserRequest(BaseModel):
    reason: str = "Dihapus oleh administrator"


def _profile_row(row: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if row is None:
        return None
    photo_key = row.pop("profile_photo_key", None)
    row["profile_photo_url"] = _profile_photo_url(photo_key) if photo_key else None
    return row


def _image_matches_content_type(data: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


@router.get("")
async def list_users(
    role: Optional[str] = Query(None),
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """List semua user (khusus admin, tanpa password_hash)."""
    if role and role not in {"admin", "dokter", "pasien"}:
        raise HTTPException(status_code=400, detail="Role tidak valid")
    if role:
        query = "SELECT id, username, role, is_active, created_at FROM users WHERE role = %s AND is_deleted = FALSE ORDER BY id ASC;"
        rows = await fetch_all(query, (role,))
    else:
        query = "SELECT id, username, role, is_active, created_at FROM users WHERE is_deleted = FALSE AND role IN ('admin','dokter','pasien') ORDER BY id ASC;"
        rows = await fetch_all(query)
    return rows


@router.get("/doctors")
async def list_doctors(
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """List semua dokter beserta profil (dapat diakses oleh semua role yang login)."""
    query = """
        SELECT u.id AS user_id, u.username, u.is_active, u.created_at,
               d.id, d.full_name, d.specialization, d.str_number, d.phone,
               d.workplace, d.profile_photo_key
        FROM users u
        JOIN doctors d ON d.user_id = u.id
        WHERE u.role = 'dokter' AND u.is_deleted = FALSE
        ORDER BY d.full_name ASC;
    """
    return [_profile_row(row) for row in await fetch_all(query)]


@router.get("/patients")
async def list_patients(
    current_user: dict[str, Any] = Depends(require_roles("admin", "dokter")),
):
    """List semua pasien beserta profil (khusus dokter dan admin)."""
    query = """
        SELECT u.id AS user_id, u.username, u.is_active, u.created_at,
               p.id, p.nik, p.full_name, p.birth_date, p.gender, p.phone, p.address,
               p.blood_type, p.allergies, p.profile_photo_key
        FROM users u
        JOIN patients p ON p.user_id = u.id
        WHERE u.role = 'pasien' AND u.is_deleted = FALSE
        ORDER BY p.full_name ASC;
    """
    return [_profile_row(row) for row in await fetch_all(query)]


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
                INSERT INTO doctors (user_id, full_name, specialization, str_number, phone, workplace)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, user_id, full_name, specialization, str_number, phone, workplace;
                """,
                (
                    user_id,
                    full_name,
                    req.specialization.strip() if req.specialization else None,
                    req.strNumber.strip() if req.strNumber else None,
                    req.phone.strip() if req.phone else None,
                    req.workplace.strip() if req.workplace else None,
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


@router.post("/patient", status_code=status.HTTP_201_CREATED)
async def create_patient(
    req: CreatePatientRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Admin membuat akun pasien dan profil pasien dalam satu transaksi."""
    username = req.username.strip()
    full_name = req.fullName.strip()
    nik = req.nik.strip() if req.nik else None

    if not username or not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email dan nama lengkap wajib diisi",
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
    if nik and len(nik) > 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NIK maksimal 16 karakter",
        )

    existing_user = await fetch_one("SELECT id FROM users WHERE username = %s", (username,))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah digunakan oleh akun lain",
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
            await cur.execute(
                """
                INSERT INTO patients (
                    user_id, nik, full_name, birth_date, gender, phone,
                    address, blood_type, allergies
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, user_id, nik, full_name, birth_date, gender,
                          phone, address, blood_type, allergies;
                """,
                (
                    user_row["id"], nik, full_name, req.birthDate, gender,
                    req.phone.strip() if req.phone else None,
                    req.address.strip() if req.address else None,
                    req.bloodType.strip() if req.bloodType else None,
                    req.allergies.strip() if req.allergies else None,
                ),
            )
            patient_row = await cur.fetchone()

    await audit(
        request=request,
        user=current_user,
        action="CREATE",
        table="users",
        record_id=user_row["id"],
        severity="success",
        details=f"Admin mendaftarkan pasien baru: {full_name} ({username}).",
    )
    return {"user": user_row, "patient": patient_row}


@router.patch("/{id}/toggle")
@router.patch("/{id}/toggle-status")
async def toggle_user_active(
    id: int,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Admin mengaktifkan atau menonaktifkan akun user."""
    user = await fetch_one("SELECT id, username, role, is_active FROM users WHERE id = %s AND is_deleted = FALSE", (id,))
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

    user = await fetch_one("SELECT id, username, role FROM users WHERE id = %s AND is_deleted = FALSE", (id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan",
        )

    role = user["role"]
    if role == "pasien":
        gender = normalize_gender(req.gender)
        if req.gender and req.gender.strip() != "-" and gender is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Jenis kelamin harus Laki-laki atau Perempuan",
            )
        await execute(
            """
            UPDATE patients
            SET full_name = COALESCE(%s, full_name),
                nik = COALESCE(%s, nik),
                birth_date = COALESCE(%s, birth_date),
                gender = CASE WHEN %s = '-' THEN NULL ELSE COALESCE(%s, gender) END,
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
                req.gender.strip() if req.gender else None,
                gender,
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
                str_number = COALESCE(%s, str_number),
                phone = COALESCE(%s, phone),
                workplace = COALESCE(%s, workplace)
            WHERE user_id = %s;
            """,
            (
                req.fullName.strip() if req.fullName else None,
                req.specialization.strip() if req.specialization else None,
                req.strNumber.strip() if req.strNumber else None,
                req.phone.strip() if req.phone else None,
                req.workplace.strip() if req.workplace else None,
                id,
            ),
        )
    else:
        raise HTTPException(status_code=403, detail="Profil role ini tidak dapat diperbarui")

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


@router.post("/{id}/profile-photo")
async def upload_profile_photo(
    id: int,
    request: Request,
    image: UploadFile = File(...),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    if current_user["role"] not in {"pasien", "dokter"}:
        raise HTTPException(status_code=403, detail="Role ini tidak memiliki profil foto")
    if current_user["role"] != "admin" and current_user["id"] != id:
        raise HTTPException(status_code=403, detail="Tidak memiliki izin untuk mengubah foto pengguna lain")

    content_type = (image.content_type or "").lower()
    extension = PROFILE_IMAGE_TYPES.get(content_type)
    if not extension:
        raise HTTPException(status_code=415, detail="Foto profil hanya menerima JPG, PNG, atau WebP")

    data = await image.read(MAX_PROFILE_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="File foto kosong")
    if len(data) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Ukuran foto profil maksimal 5 MB")
    if not _image_matches_content_type(data, content_type):
        raise HTTPException(status_code=415, detail="Isi file tidak sesuai dengan format gambar")

    user = await fetch_one(
        "SELECT id, role FROM users WHERE id = %s AND is_deleted = FALSE",
        (id,),
    )
    if not user or user["role"] not in {"pasien", "dokter"}:
        raise HTTPException(status_code=404, detail="Profil pengguna tidak ditemukan")

    profile_table = "patients" if user["role"] == "pasien" else "doctors"
    previous = await fetch_one(
        f"SELECT profile_photo_key FROM {profile_table} WHERE user_id = %s",
        (id,),
    )
    if not previous:
        raise HTTPException(status_code=404, detail="Profil pengguna tidak ditemukan")

    object_key = f"profile/{id}/{uuid.uuid4().hex}{extension}"
    try:
        s3 = _s3_client()
        _ensure_bucket(s3)
        s3.put_object(
            Bucket=settings.MINIO_BUCKET,
            Key=object_key,
            Body=data,
            ContentType=content_type,
        )
    except Exception as exc:
        logger.exception("Gagal menyimpan foto profil user_id=%s", id)
        raise HTTPException(status_code=503, detail="Gagal menyimpan foto profil ke object storage") from exc

    try:
        await execute(
            f"UPDATE {profile_table} SET profile_photo_key = %s WHERE user_id = %s",
            (object_key, id),
        )
    except Exception:
        try:
            s3.delete_object(
                Bucket=settings.MINIO_BUCKET,
                Key=object_key,
            )
        except Exception:
            logger.exception("Gagal membersihkan foto profil yang tidak tersimpan, key=%s", object_key)
        raise

    await audit(
        request=request,
        user=current_user,
        action="UPDATE",
        table=profile_table,
        record_id=id,
        severity="info",
        details=f"Foto profil akun {user['role']} ID={id} diperbarui.",
    )

    if previous.get("profile_photo_key"):
        try:
            s3.delete_object(
                Bucket=settings.MINIO_BUCKET,
                Key=previous["profile_photo_key"],
            )
        except Exception:
            logger.exception("Gagal menghapus foto profil lama, key=%s", previous["profile_photo_key"])

    return {"profile_photo_url": _profile_photo_url(object_key)}


@router.delete("/{id}")
async def delete_user(
    id: int,
    req: DeleteUserRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    user = await fetch_one(
        "SELECT id, username, role FROM users WHERE id = %s AND is_deleted = FALSE",
        (id,),
    )
    if not user or user["role"] not in {"pasien", "dokter"}:
        raise HTTPException(status_code=404, detail="Akun pasien atau dokter tidak ditemukan")

    reason = req.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Alasan penghapusan wajib diisi")
    await execute(
        """
        UPDATE users
        SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s, delete_reason = %s
        WHERE id = %s;
        """,
        (current_user["username"], reason, id),
    )
    await audit(
        request=request,
        user=current_user,
        action="DELETE",
        table="users",
        record_id=id,
        severity="warning",
        details=f"Akun {user['role']} '{user['username']}' dihapus sementara. Alasan: {reason}.",
    )
    return {"message": "Akun berhasil dipindahkan ke pemulihan admin"}

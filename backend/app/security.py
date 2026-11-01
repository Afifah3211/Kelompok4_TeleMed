import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import fetch_one

security_scheme = HTTPBearer(auto_error=False)


def _hash_password_sync(password: str) -> str:
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _verify_password_sync(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


async def hash_password(password: str) -> str:
    """Hash password dengan bcrypt (cost 10) di thread pool agar tidak memblokir event loop."""
    return await asyncio.to_thread(_hash_password_sync, password)


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifikasi bcrypt di thread pool."""
    return await asyncio.to_thread(_verify_password_sync, plain_password, hashed_password)


def create_access_token(user_id: int, role: str, pid: Optional[int] = None) -> str:
    """Buat token JWT HS256 dengan klaim sub, role, pid, exp."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=settings.jwt_expires_seconds)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "pid": pid,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode dan verifikasi JWT token."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi telah kedaluwarsa",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi tidak valid",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> dict[str, Any]:
    """Dependency untuk mendapatkan user aktif dari JWT."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi tidak ditemukan",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = decode_access_token(token)

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Klaim subject (sub) tidak ditemukan dalam token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Klaim subject (sub) token tidak valid",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await fetch_one(
        "SELECT id, username, role, is_active FROM users WHERE id = %s",
        (user_id,),
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User pengguna tidak ditemukan",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun pengguna dinonaktifkan",
        )

    pid = payload.get("pid")
    if pid is None:
        role = user["role"]
        if role == "pasien":
            p = await fetch_one("SELECT id FROM patients WHERE user_id = %s", (user_id,))
            if p:
                pid = p["id"]
        elif role == "dokter":
            d = await fetch_one("SELECT id FROM doctors WHERE user_id = %s", (user_id,))
            if d:
                pid = d["id"]
        elif role == "apoteker":
            ph = await fetch_one("SELECT id FROM pharmacists WHERE user_id = %s", (user_id,))
            if ph:
                pid = ph["id"]

    user["pid"] = pid
    return user


def require_roles(*allowed_roles: str) -> Callable:
    """Dependency RBAC untuk memeriksa role user."""
    async def role_checker(
        current_user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak: role '{current_user['role']}' tidak memiliki izin",
            )
        return current_user

    return role_checker

"""
files.py — Router upload/download aset statis via MinIO (Pertemuan 5 CDN)

Endpoint:
  POST   /api/files/upload          Upload file ke MinIO, return URL publik
  GET    /api/files/presign/{key}   Presigned URL download (1 jam)
  GET    /api/files/list            Daftar semua file di bucket (admin)
  DELETE /api/files/{key}           Hapus file (admin)
"""

import io
import os
import uuid
from typing import Any

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.audit import audit
from app.config import settings
from app.security import get_current_user, require_roles

router = APIRouter()

# ------------------------------------------------------------------ #
# Helper: buat S3 client yang menunjuk ke MinIO                       #
# ------------------------------------------------------------------ #
ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/plain",
}
MAX_SIZE_BYTES = 10 * 1024 * 1024   # 10 MB


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def _ensure_bucket(s3):
    """Buat bucket jika belum ada."""
    try:
        s3.head_bucket(Bucket=settings.MINIO_BUCKET)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchBucket"):
            s3.create_bucket(Bucket=settings.MINIO_BUCKET)
            # Set public-read policy agar file bisa diakses langsung via Nginx proxy
            policy = f"""{{
  "Version":"2012-10-17",
  "Statement":[{{
    "Effect":"Allow",
    "Principal":"*",
    "Action":"s3:GetObject",
    "Resource":"arn:aws:s3:::{settings.MINIO_BUCKET}/*"
  }}]
}}"""
            s3.put_bucket_policy(Bucket=settings.MINIO_BUCKET, Policy=policy)
        else:
            raise


def init_minio_bucket():
    """Inisialisasi bucket default saat backend startup."""
    try:
        s3 = _s3_client()
        _ensure_bucket(s3)
        return True
    except Exception:
        return False


# ------------------------------------------------------------------ #
# POST /api/files/upload                                              #
# ------------------------------------------------------------------ #
@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    Upload file ke MinIO.
    Hanya tipe file yang diizinkan (gambar + PDF + teks) dan ukuran <= 10 MB.
    Mengembalikan URL publik dan object key untuk disimpan di DB.
    """
    # Validasi MIME
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipe file tidak diizinkan: {file.content_type}. "
                   f"Diizinkan: {', '.join(sorted(ALLOWED_MIME))}",
        )

    # Baca & validasi ukuran
    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Ukuran file melebihi batas maksimal 10 MB (ukuran: {len(data)} bytes)",
        )

    # Buat object key unik: role/uuid.ext
    ext = os.path.splitext(file.filename or "file")[1].lower() or ".bin"
    role = current_user.get("role", "user")
    object_key = f"{role}/{uuid.uuid4().hex}{ext}"

    # Upload ke MinIO
    try:
        s3 = _s3_client()
        _ensure_bucket(s3)
        s3.upload_fileobj(
            io.BytesIO(data),
            settings.MINIO_BUCKET,
            object_key,
            ExtraArgs={"ContentType": file.content_type},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Gagal upload ke MinIO: {exc}",
        )

    public_url = f"{settings.MINIO_PUBLIC_HOST}/{settings.MINIO_BUCKET}/{object_key}"

    return {
        "key": object_key,
        "url": public_url,
        "filename": file.filename,
        "size_bytes": len(data),
        "content_type": file.content_type,
        "cdn_url": f"/files/{object_key}",
        "message": "File berhasil diupload ke MinIO",
    }


# ------------------------------------------------------------------ #
# GET /api/files/presign/{key}                                        #
# ------------------------------------------------------------------ #
@router.get("/presign/{key:path}")
async def presign_url(
    key: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    Generate presigned URL untuk download file privat (berlaku 1 jam).
    """
    try:
        s3 = _s3_client()
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.MINIO_BUCKET, "Key": key},
            ExpiresIn=3600,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Gagal membuat presigned URL: {exc}",
        )

    return {"key": key, "presigned_url": url, "expires_in": 3600}


# ------------------------------------------------------------------ #
# GET /api/files/list                                                 #
# ------------------------------------------------------------------ #
@router.get("/list")
async def list_files(
    current_user: dict[str, Any] = Depends(require_roles("admin", "dokter")),
):
    """
    Daftar semua file di bucket MinIO (admin & dokter).
    """
    try:
        s3 = _s3_client()
        _ensure_bucket(s3)
        resp = s3.list_objects_v2(Bucket=settings.MINIO_BUCKET)
        objects = resp.get("Contents", [])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Gagal mengambil daftar file dari MinIO: {exc}",
        )

    return {
        "bucket": settings.MINIO_BUCKET,
        "total": len(objects),
        "files": [
            {
                "key": obj["Key"],
                "size_bytes": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
                "url": f"{settings.MINIO_PUBLIC_HOST}/{settings.MINIO_BUCKET}/{obj['Key']}",
                "cdn_url": f"/files/{obj['Key']}",
            }
            for obj in objects
        ],
    }


# ------------------------------------------------------------------ #
# DELETE /api/files/{key}                                             #
# ------------------------------------------------------------------ #
@router.delete("/{key:path}", status_code=status.HTTP_200_OK)
async def delete_file(
    key: str,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Hapus file dari MinIO (hanya admin).
    """
    try:
        s3 = _s3_client()
        s3.delete_object(Bucket=settings.MINIO_BUCKET, Key=key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Gagal menghapus file dari MinIO: {exc}",
        )

    return {"message": f"File '{key}' berhasil dihapus dari MinIO", "key": key}

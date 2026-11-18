"""Consultation chat messages and image attachments stored in PostgreSQL/MinIO."""

import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.config import settings
from app.db import execute, fetch_all, fetch_one
from app.routers.files import _cdn_url, _ensure_bucket, _s3_client
from app.security import get_current_user

router = APIRouter()
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


async def ensure_chat_schema() -> None:
    """Create chat metadata table for both new and already-initialized DB volumes."""
    await execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id BIGSERIAL PRIMARY KEY,
            consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
            sender_user_id INTEGER NOT NULL REFERENCES users(id),
            body TEXT,
            attachment_key VARCHAR(512),
            attachment_name VARCHAR(255),
            attachment_content_type VARCHAR(100),
            attachment_size_bytes BIGINT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chat_message_has_content CHECK (
                NULLIF(BTRIM(body), '') IS NOT NULL OR attachment_key IS NOT NULL
            )
        );
        """
    )
    await execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation_created "
        "ON chat_messages(consultation_id, created_at, id);"
    )


async def _consultation_for_participant(
    consultation_id: int, user: dict[str, Any]
) -> dict[str, Any]:
    consultation = await fetch_one(
        "SELECT id, patient_id, doctor_id, status, type FROM consultations WHERE id = %s;",
        (consultation_id,),
    )
    if not consultation:
        raise HTTPException(status_code=404, detail="Konsultasi tidak ditemukan")

    role = user.get("role")
    profile_id = user.get("pid")
    is_patient = role == "pasien" and consultation["patient_id"] == profile_id
    is_assigned_doctor = role == "dokter" and consultation["doctor_id"] == profile_id
    if not (is_patient or is_assigned_doctor):
        raise HTTPException(
            status_code=403,
            detail="Chat hanya dapat diakses pasien dan dokter yang ditugaskan pada konsultasi ini",
        )

    consultation_type = str(consultation.get("type") or "").strip().lower()
    if "chat" not in consultation_type and "konsultasi online" not in consultation_type:
        raise HTTPException(
            status_code=409,
            detail="Chat dan lampiran hanya tersedia untuk konsultasi bermetode Chat",
        )
    return consultation


def _message_response(row: dict[str, Any]) -> dict[str, Any]:
    attachment = None
    if row.get("attachment_key"):
        attachment = {
            "filename": row["attachment_name"],
            "content_type": row["attachment_content_type"],
            "size_bytes": row["attachment_size_bytes"],
            "url": _cdn_url(row["attachment_key"], ttl_seconds=3600),
        }
    return {
        "id": row["id"],
        "consultation_id": row["consultation_id"],
        "sender_user_id": row["sender_user_id"],
        "sender_role": row["sender_role"],
        "sender_name": row["sender_name"],
        "body": row["body"] or "",
        "created_at": row["created_at"],
        "attachment": attachment,
    }


MESSAGE_SELECT = """
    SELECT m.id, m.consultation_id, m.sender_user_id, u.role AS sender_role,
           COALESCE(p.full_name, d.full_name, u.username) AS sender_name,
           m.body, m.attachment_key, m.attachment_name,
           m.attachment_content_type, m.attachment_size_bytes, m.created_at
    FROM chat_messages m
    JOIN users u ON u.id = m.sender_user_id
    LEFT JOIN patients p ON p.user_id = u.id
    LEFT JOIN doctors d ON d.user_id = u.id
"""


@router.get("/consultations/{consultation_id}/messages")
async def get_messages(
    consultation_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    await _consultation_for_participant(consultation_id, current_user)
    rows = await fetch_all(
        MESSAGE_SELECT
        + " WHERE m.consultation_id = %s ORDER BY m.created_at, m.id;",
        (consultation_id,),
    )
    return [_message_response(row) for row in rows]


@router.post(
    "/consultations/{consultation_id}/messages",
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    consultation_id: int,
    message: str = Form(default="", max_length=2000),
    image: UploadFile | None = File(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    consultation = await _consultation_for_participant(consultation_id, current_user)
    if consultation["status"] in {"Selesai", "Dibatalkan"}:
        raise HTTPException(status_code=409, detail="Konsultasi sudah ditutup; chat hanya dapat dibaca")

    body = message.strip()
    if not body and image is None:
        raise HTTPException(status_code=400, detail="Isi pesan atau lampirkan gambar terlebih dahulu")

    object_key = None
    filename = None
    content_type = None
    size_bytes = None
    if image is not None:
        content_type = (image.content_type or "").lower()
        if content_type not in IMAGE_TYPES:
            raise HTTPException(status_code=415, detail="Lampiran chat hanya menerima JPG, PNG, atau WebP")
        data = await image.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Ukuran gambar maksimal 5 MB")
        if not data:
            raise HTTPException(status_code=400, detail="File gambar kosong")

        raw_name = (image.filename or "gambar").replace("\\", "/").rsplit("/", 1)[-1]
        filename = os.path.basename(raw_name)[:255] or "gambar"
        extension = IMAGE_TYPES[content_type]
        object_key = f"chat/{consultation_id}/{uuid.uuid4().hex}{extension}"
        size_bytes = len(data)
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
            raise HTTPException(status_code=503, detail=f"Gagal menyimpan gambar chat ke object storage: {exc}")

    try:
        row = await fetch_one(
            """
            INSERT INTO chat_messages (
                consultation_id, sender_user_id, body, attachment_key,
                attachment_name, attachment_content_type, attachment_size_bytes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                consultation_id,
                current_user["id"],
                body or None,
                object_key,
                filename,
                content_type,
                size_bytes,
            ),
        )
    except Exception:
        if object_key:
            try:
                _s3_client().delete_object(Bucket=settings.MINIO_BUCKET, Key=object_key)
            except Exception:
                pass
        raise

    saved = await fetch_one(
        MESSAGE_SELECT + " WHERE m.id = %s;",
        (row["id"],),
    )

    return _message_response(saved)

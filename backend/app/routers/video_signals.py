import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from psycopg.types.json import Jsonb

from app.db import execute, fetch_all, fetch_one, transaction
from app.security import get_current_user

router = APIRouter()
MAX_SIGNAL_BYTES = 64 * 1024
VIDEO_SESSION_TIMEOUT = timedelta(hours=2)


class VideoSignalRequest(BaseModel):
    session_id: UUID
    signal_type: Literal["offer", "answer", "candidate", "hangup"]
    payload: dict[str, Any] = Field(default_factory=dict)


async def ensure_video_schema() -> None:
    await execute(
        """
        CREATE TABLE IF NOT EXISTS consultation_video_sessions (
            consultation_id INTEGER PRIMARY KEY REFERENCES consultations(id) ON DELETE CASCADE,
            session_id UUID NOT NULL,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ended_at TIMESTAMPTZ
        );
        """
    )
    await execute(
        """
        CREATE TABLE IF NOT EXISTS consultation_video_signals (
            id BIGSERIAL PRIMARY KEY,
            consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
            session_id UUID NOT NULL,
            sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            signal_type VARCHAR(20) NOT NULL
                CHECK (signal_type IN ('offer', 'answer', 'candidate', 'hangup')),
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    await execute(
        """
        CREATE INDEX IF NOT EXISTS idx_video_signals_room
        ON consultation_video_signals(consultation_id, session_id, id);
        """
    )


async def _video_consultation_for_participant(
    consultation_id: int,
    current_user: dict[str, Any],
    require_active: bool = True,
) -> dict[str, Any]:
    consultation = await fetch_one(
        "SELECT id, patient_id, doctor_id, status, type FROM consultations WHERE id = %s AND is_deleted = FALSE;",
        (consultation_id,),
    )
    if not consultation:
        raise HTTPException(status_code=404, detail="Konsultasi tidak ditemukan")

    role = current_user.get("role")
    profile_id = current_user.get("pid")
    is_patient = role == "pasien" and consultation["patient_id"] == profile_id
    is_assigned_doctor = role == "dokter" and consultation["doctor_id"] == profile_id
    if not (is_patient or is_assigned_doctor):
        raise HTTPException(
            status_code=403,
            detail="Video hanya dapat diakses pasien dan dokter yang ditugaskan pada konsultasi ini.",
        )

    consultation_type = str(consultation.get("type") or "").strip().lower()
    if "video" not in consultation_type and "telekonsultasi" not in consultation_type:
        raise HTTPException(
            status_code=409,
            detail="Koneksi kamera hanya tersedia untuk konsultasi bermetode Video Call.",
        )
    if require_active and consultation["status"] != "Sedang Berlangsung":
        raise HTTPException(
            status_code=409,
            detail="Mulai konsultasi terlebih dahulu sebelum membuka kamera.",
        )
    return consultation


async def _get_video_session(consultation_id: int, session_id: UUID):
    video_session = await fetch_one(
        """
        SELECT session_id, started_at, ended_at
        FROM consultation_video_sessions
        WHERE consultation_id = %s;
        """,
        (consultation_id,),
    )
    if not video_session or video_session["session_id"] != session_id:
        raise HTTPException(status_code=409, detail="Sesi video sudah berakhir atau tidak berlaku.")
    return video_session


@router.post("/consultations/{consultation_id}/join")
async def join_video_session(
    consultation_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    await _video_consultation_for_participant(consultation_id, current_user)
    await execute(
        "DELETE FROM consultation_video_signals WHERE created_at < NOW() - INTERVAL '1 day';"
    )

    async with transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO consultation_video_sessions (consultation_id, session_id)
                VALUES (%s, %s)
                ON CONFLICT (consultation_id) DO NOTHING;
                """,
                (consultation_id, uuid.uuid4()),
            )
            await cur.execute(
                """
                SELECT session_id, started_at, ended_at
                FROM consultation_video_sessions
                WHERE consultation_id = %s
                FOR UPDATE;
                """,
                (consultation_id,),
            )
            video_session = await cur.fetchone()

            expired = video_session["started_at"] < datetime.now(timezone.utc) - VIDEO_SESSION_TIMEOUT
            if video_session["ended_at"] or expired:
                session_id = uuid.uuid4()
                await cur.execute(
                    """
                    UPDATE consultation_video_sessions
                    SET session_id = %s, started_at = NOW(), ended_at = NULL
                    WHERE consultation_id = %s;
                    """,
                    (session_id, consultation_id),
                )
            else:
                session_id = video_session["session_id"]

    return {"session_id": str(session_id)}


@router.get("/consultations/{consultation_id}/signals")
async def get_video_signals(
    consultation_id: int,
    session_id: UUID,
    after_id: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    await _video_consultation_for_participant(
        consultation_id, current_user, require_active=False
    )
    await _get_video_session(consultation_id, session_id)
    return await fetch_all(
        """
        SELECT id, sender_user_id, signal_type, payload
        FROM consultation_video_signals
        WHERE consultation_id = %s
          AND session_id = %s
          AND sender_user_id <> %s
          AND id > %s
        ORDER BY id
        LIMIT 100;
        """,
        (consultation_id, session_id, current_user["id"], after_id),
    )


@router.post(
    "/consultations/{consultation_id}/signals",
    status_code=status.HTTP_201_CREATED,
)
async def send_video_signal(
    consultation_id: int,
    req: VideoSignalRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    await _video_consultation_for_participant(consultation_id, current_user)
    if len(json.dumps(req.payload, separators=(",", ":")).encode("utf-8")) > MAX_SIGNAL_BYTES:
        raise HTTPException(status_code=413, detail="Data koneksi video terlalu besar.")

    async with transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT session_id, ended_at
                FROM consultation_video_sessions
                WHERE consultation_id = %s
                FOR UPDATE;
                """,
                (consultation_id,),
            )
            video_session = await cur.fetchone()
            if not video_session or video_session["session_id"] != req.session_id:
                raise HTTPException(status_code=409, detail="Sesi video sudah berakhir atau tidak berlaku.")
            if video_session["ended_at"] and req.signal_type != "hangup":
                raise HTTPException(status_code=409, detail="Sesi video sudah diakhiri.")

            if req.signal_type == "hangup":
                await cur.execute(
                    """
                    UPDATE consultation_video_sessions
                    SET ended_at = COALESCE(ended_at, NOW())
                    WHERE consultation_id = %s;
                    """,
                    (consultation_id,),
                )
            await cur.execute(
                """
                INSERT INTO consultation_video_signals (
                    consultation_id, session_id, sender_user_id, signal_type, payload
                ) VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (
                    consultation_id,
                    req.session_id,
                    current_user["id"],
                    req.signal_type,
                    Jsonb(req.payload),
                ),
            )
            signal = await cur.fetchone()

    return {"id": signal["id"]}

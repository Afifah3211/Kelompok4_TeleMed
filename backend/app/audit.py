import logging
from typing import Any, Optional
from fastapi import Request

from app.db import execute

logger = logging.getLogger(__name__)


async def audit(
    request: Optional[Request],
    user: Optional[dict[str, Any]],
    action: str,
    table: Optional[str] = None,
    record_id: Optional[int] = None,
    severity: str = "info",
    details: Optional[str] = None,
) -> None:
    """Helper untuk menulis catatan aktivitas ke tabel audit_logs."""
    try:
        user_id = user.get("id") if user else None
        user_name = None
        if user:
            user_name = user.get("username") or user.get("user_name")

        ip_address = "127.0.0.1"
        if request and request.client:
            ip_address = request.client.host

        await execute(
            """
            INSERT INTO audit_logs (
                user_id, user_name, action, table_name, record_id, ip_address, severity, details
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (user_id, user_name, action, table, record_id, ip_address, severity, details),
        )
    except Exception as exc:
        logger.error(f"[Audit] Gagal mencatat audit log: {exc}")

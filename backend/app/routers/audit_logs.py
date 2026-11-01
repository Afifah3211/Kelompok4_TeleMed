import csv
import io
import time
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse

from app.db import fetch_all
from app.security import require_roles

router = APIRouter()


@router.get("")
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    List audit logs (hanya admin).
    Mendukung filter search, action, user_id, from, to, dan limit (default 100, maks 500).
    """
    # Batasi limit maksimal 500
    clamped_limit = max(1, min(limit, 500))

    where_clauses = ["1=1"]
    params = []

    if action:
        where_clauses.append("action = %s")
        params.append(action.strip())

    if user_id is not None:
        where_clauses.append("user_id = %s")
        params.append(user_id)

    if from_date:
        where_clauses.append("created_at >= %s")
        params.append(from_date.strip())

    if to_date:
        where_clauses.append("created_at <= %s")
        params.append(to_date.strip())

    if search:
        search_pattern = f"%{search.strip()}%"
        where_clauses.append(
            "(details ILIKE %s OR user_name ILIKE %s OR table_name ILIKE %s OR action ILIKE %s OR ip_address ILIKE %s)"
        )
        params.extend([search_pattern] * 5)

    where_sql = " AND ".join(where_clauses)
    query = f"""
        SELECT id, user_id, user_name, action, table_name, record_id,
               ip_address, severity, details, created_at
        FROM audit_logs
        WHERE {where_sql}
        ORDER BY created_at DESC, id DESC
        LIMIT %s;
    """
    params.append(clamped_limit)
    return await fetch_all(query, tuple(params))


@router.get("/export/csv")
async def export_audit_logs_csv(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Export audit logs ke format CSV dengan UTF-8 BOM dan escaping aman (khusus admin).
    """
    query = """
        SELECT id, created_at, user_id, user_name, action, table_name,
               record_id, ip_address, severity, details
        FROM audit_logs
        ORDER BY created_at DESC, id DESC;
    """
    rows = await fetch_all(query)

    output = io.StringIO()
    # Tulis UTF-8 Byte Order Mark (BOM) agar Excel mengenali UTF-8 dengan baik
    output.write("\ufeff")

    writer = csv.writer(
        output,
        delimiter=",",
        quotechar='"',
        quoting=csv.QUOTE_MINIMAL,
        lineterminator="\r\n",
    )

    header = [
        "ID",
        "Waktu",
        "User ID",
        "Username",
        "Aksi",
        "Tabel",
        "Record ID",
        "IP",
        "Severity",
        "Detail",
    ]
    writer.writerow(header)

    for r in rows:
        created_str = r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"])
        writer.writerow([
            r["id"],
            created_str,
            r["user_id"] if r["user_id"] is not None else "",
            r["user_name"] or "",
            r["action"] or "",
            r["table_name"] or "",
            r["record_id"] if r["record_id"] is not None else "",
            r["ip_address"] or "",
            r["severity"] or "",
            r["details"] or "",
        ])

    csv_data = output.getvalue().encode("utf-8")
    output.close()

    filename = f"audit_logs_{int(time.time())}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )

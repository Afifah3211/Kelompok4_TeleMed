from typing import Any
from fastapi import APIRouter, Depends

from app.db import fetch_all, fetch_one
from app.security import require_roles

router = APIRouter()


@router.get("/status")
async def get_drp_status(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Status DRP (Disaster Recovery Plan) dan WAL Archiving (khusus admin).
    Menampilkan:
    - Ukuran fisik database PostgreSQL
    - Status pg_stat_archiver (archived_count, failed_count, last_archived_wal, last_archived_time)
    - Jumlah baris data pada seluruh tabel inti
    - 5 riwayat backup terakhir
    """
    db_size_row = await fetch_one(
        """
        SELECT pg_database_size(current_database()) AS db_size_bytes,
               pg_size_pretty(pg_database_size(current_database())) AS db_size_pretty;
        """
    )

    archiver_row = await fetch_one(
        """
        SELECT archived_count,
               failed_count,
               last_archived_wal,
               last_archived_time,
               last_failed_wal,
               last_failed_time,
               stats_reset
        FROM pg_stat_archiver;
        """
    )

    counts_row = await fetch_one(
        """
        SELECT
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM patients) AS patients,
            (SELECT COUNT(*) FROM doctors) AS doctors,
            (SELECT COUNT(*) FROM pharmacists) AS pharmacists,
            (SELECT COUNT(*) FROM consultations) AS consultations,
            (SELECT COUNT(*) FROM medical_records) AS medical_records,
            (SELECT COUNT(*) FROM medicines) AS medicines,
            (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
            (SELECT COUNT(*) FROM prescription_items) AS prescription_items,
            (SELECT COUNT(*) FROM audit_logs) AS audit_logs;
        """
    )

    recent_backups = await fetch_all(
        "SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 5;"
    )

    return {
        "database": {
            "size_bytes": db_size_row["db_size_bytes"] if db_size_row else 0,
            "size_pretty": db_size_row["db_size_pretty"] if db_size_row else "0 B",
        },
        "archiver": archiver_row or {},
        "table_counts": counts_row or {},
        "recent_backups": recent_backups,
    }

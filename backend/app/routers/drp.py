from typing import Any

from fastapi import APIRouter, Depends

from app.db import fetch_all, fetch_one
from app.security import require_roles

router = APIRouter()


@router.get("/status")
async def get_drp_status(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Expose real PostgreSQL size, WAL archiver counters, table count and backup job history."""
    db_size_row = await fetch_one(
        """
        SELECT pg_database_size(current_database()) AS db_size_bytes,
               pg_size_pretty(pg_database_size(current_database())) AS db_size_pretty;
        """
    )
    archiver_row = await fetch_one(
        """
        SELECT archived_count, failed_count,
               last_archived_wal, last_archived_time,
               last_failed_wal, last_failed_time, stats_reset
        FROM pg_stat_archiver;
        """
    )
    table_count_row = await fetch_one(
        "SELECT COUNT(*) AS public_table_count FROM pg_tables WHERE schemaname = 'public';"
    )
    recent_backups = await fetch_all(
        "SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 5;"
    )

    return {
        "database": {
            "status": "CONNECTED",
            "size_bytes": db_size_row["db_size_bytes"] if db_size_row else 0,
            "size_pretty": db_size_row["db_size_pretty"] if db_size_row else "0 B",
            "public_table_count": table_count_row["public_table_count"] if table_count_row else 0,
        },
        "archiver": archiver_row or {},
        "recent_backups": recent_backups,
        "recovery_drill": {
            "script": "dr_test.ps1",
            "scenario": "full_database_restore_to_isolated_database",
            "wal_pitr_validated": False,
            "host_failover_validated": False,
        },
    }

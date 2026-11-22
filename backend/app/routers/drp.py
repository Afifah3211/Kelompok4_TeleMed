import asyncio
import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app.audit import audit
from app.config import settings
from app.db import execute, fetch_all, fetch_one
from app.security import require_roles

router = APIRouter()


def _get_pitr_dir() -> str:
    """Kembalikan direktori snapshot dump yang bisa ditulis."""
    preferred = "/backups/pitr"
    try:
        os.makedirs(preferred, exist_ok=True)
        test_file = os.path.join(preferred, ".write_test")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
        return preferred
    except (PermissionError, OSError):
        fallback = "/tmp/pitr"
        os.makedirs(fallback, exist_ok=True)
        return fallback


PITR_DIR = _get_pitr_dir()


# ============================================================
# GET /api/drp/status — Status database & DRP
# ============================================================
@router.get("/status")
async def get_drp_status(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Status DRP (Disaster Recovery Plan) dan WAL Archiving (khusus admin).
    Menampilkan ukuran DB, status archiver, jumlah data, dan riwayat backup.
    """
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

    # Cek apakah tabel medical_records masih ada (deteksi insiden DROP TABLE)
    table_exists_row = await fetch_one(
        """
        SELECT COUNT(*) AS cnt
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'medical_records';
        """
    )
    medical_records_table_exists = (table_exists_row["cnt"] > 0) if table_exists_row else False

    if medical_records_table_exists:
        counts_row = await fetch_one(
            """
            SELECT
                (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM patients) AS patients,
                (SELECT COUNT(*) FROM doctors) AS doctors,
                (SELECT COUNT(*) FROM consultations) AS consultations,
                (SELECT COUNT(*) FROM medical_records) AS medical_records,
                (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
                (SELECT COUNT(*) FROM prescription_items) AS prescription_items,
                (SELECT COUNT(*) FROM audit_logs) AS audit_logs;
            """
        )
    else:
        counts_row = await fetch_one(
            """
            SELECT
                (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM patients) AS patients,
                (SELECT COUNT(*) FROM doctors) AS doctors,
                (SELECT COUNT(*) FROM consultations) AS consultations,
                NULL AS medical_records,
                (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
                (SELECT COUNT(*) FROM prescription_items) AS prescription_items,
                (SELECT COUNT(*) FROM audit_logs) AS audit_logs;
            """
        )

    recent_backups = await fetch_all(
        "SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 5;"
    )

    # Daftar snapshot dump manual yang tersedia (bukan WAL PITR)
    snapshots = []
    if os.path.isdir(PITR_DIR):
        for f in sorted(os.listdir(PITR_DIR), reverse=True):
            if f.endswith(".meta"):
                snapshots.append(f.replace(".meta", ""))

    return {
        "database": {
            "size_bytes": db_size_row["db_size_bytes"] if db_size_row else 0,
            "size_pretty": db_size_row["db_size_pretty"] if db_size_row else "0 B",
        },
        "incident": {
            "medical_records_table_exists": medical_records_table_exists,
            "status": "NORMAL" if medical_records_table_exists else "INCIDENT — tabel medical_records HILANG",
        },
        "archiver": archiver_row or {},
        "table_counts": counts_row or {},
        "recent_backups": recent_backups,
        "available_snapshots": snapshots,
    }


# ============================================================
# GET /api/drp/snapshots — Daftar dump manual yang tersedia
# ============================================================
@router.get("/snapshots")
async def list_snapshots(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Daftar semua dump snapshot manual yang tersedia (bukan WAL PITR)."""
    snapshots = []
    if os.path.isdir(PITR_DIR):
        for f in sorted(os.listdir(PITR_DIR), reverse=True):
            if f.endswith(".meta"):
                snapshot_id = f.replace(".meta", "")
                meta_path = os.path.join(PITR_DIR, f)
                meta = {}
                with open(meta_path) as mf:
                    for line in mf:
                        line = line.strip()
                        if "=" in line:
                            k, v = line.split("=", 1)
                            meta[k] = v
                snapshots.append({"snapshot_id": snapshot_id, **meta})
    return {"snapshots": snapshots, "count": len(snapshots)}


# ============================================================
# POST /api/drp/snapshot — Buat dump penuh manual
# ============================================================
@router.post("/snapshot")
async def create_snapshot(
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Buat dump logis penuh menggunakan pg_dump. Ini bukan PITR berbasis WAL.
    Gunakan sebelum operasi kritis sebagai titik pemulihan manual.
    """
    os.makedirs(PITR_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    snapshot_id = f"DBSNAP_{timestamp}"
    file_name = f"{snapshot_id}.dump"
    file_path = os.path.join(PITR_DIR, file_name)
    meta_path = os.path.join(PITR_DIR, f"{snapshot_id}.meta")

    # Ambil statistik sebelum snapshot
    stats_row = await fetch_one(
        """
        SELECT
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM medical_records) AS medical_records,
            (SELECT COUNT(*) FROM consultations) AS consultations,
            (SELECT COUNT(*) FROM audit_logs) AS audit_logs;
        """
    )

    # Catat di backup_runs
    run_row = await fetch_one(
        """
        INSERT INTO backup_runs (kind, status, file_name, triggered_by, started_at)
        VALUES ('snapshot', 'running', %s, %s, NOW())
        RETURNING id;
        """,
        (file_name, current_user.get("username", "admin")),
    )
    run_id = run_row["id"]

    # Eksekusi pg_dump untuk snapshot
    env = os.environ.copy()
    env["PGPASSWORD"] = settings.PGPASSWORD
    cmd = [
        "pg_dump", "-Fc",
        "-h", settings.PGHOST,
        "-p", str(settings.PGPORT),
        "-U", settings.PGUSER,
        "-d", settings.PGDATABASE,
        "-f", file_path,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120.0)
    except asyncio.TimeoutError:
        await execute(
            "UPDATE backup_runs SET status='failed', finished_at=NOW() WHERE id=%s;",
            (run_id,),
        )
        raise HTTPException(status_code=500, detail="pg_dump snapshot timeout")

    if proc.returncode != 0:
        err = stderr.decode().strip()
        await execute(
            "UPDATE backup_runs SET status='failed', finished_at=NOW() WHERE id=%s;",
            (run_id,),
        )
        raise HTTPException(status_code=500, detail=f"pg_dump error: {err}")

    size_bytes = os.stat(file_path).st_size if os.path.exists(file_path) else 0

    # Simpan metadata snapshot
    meta_content = (
        f"snapshot_id={snapshot_id}\n"
        f"timestamp={timestamp}\n"
        f"file_path={file_path}\n"
        f"size_bytes={size_bytes}\n"
        f"pre_incident_users={stats_row['users'] if stats_row else 0}\n"
        f"pre_incident_medical_records={stats_row['medical_records'] if stats_row else 0}\n"
        f"pre_incident_consultations={stats_row['consultations'] if stats_row else 0}\n"
        f"pre_incident_audit_logs={stats_row['audit_logs'] if stats_row else 0}\n"
        f"status=CLEAN_SNAPSHOT\n"
    )
    with open(meta_path, "w") as mf:
        mf.write(meta_content)

    await execute(
        "UPDATE backup_runs SET status='success', size_bytes=%s, finished_at=NOW() WHERE id=%s;",
        (size_bytes, run_id),
    )

    await audit(
        request=request, user=current_user,
        action="BACKUP", table="backup_runs", record_id=run_id,
        severity="success",
        details=f"Dump database penuh dibuat: {snapshot_id} ({size_bytes} bytes).",
    )

    return {
        "success": True,
        "snapshot_id": snapshot_id,
        "file_name": file_name,
        "size_bytes": size_bytes,
        "stats_at_snapshot": {
            "users": stats_row["users"] if stats_row else 0,
            "medical_records": stats_row["medical_records"] if stats_row else 0,
            "consultations": stats_row["consultations"] if stats_row else 0,
            "audit_logs": stats_row["audit_logs"] if stats_row else 0,
        },
        "message": f"Dump database penuh berhasil dibuat. ID snapshot: {snapshot_id}",
    }


# ============================================================

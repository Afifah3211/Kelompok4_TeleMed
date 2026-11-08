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
    """Kembalikan direktori PITR yang bisa ditulis — /backups/pitr jika ada akses, fallback /tmp/pitr."""
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
                (SELECT COUNT(*) FROM pharmacists) AS pharmacists,
                (SELECT COUNT(*) FROM consultations) AS consultations,
                (SELECT COUNT(*) FROM medical_records) AS medical_records,
                (SELECT COUNT(*) FROM medicines) AS medicines,
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
                (SELECT COUNT(*) FROM pharmacists) AS pharmacists,
                (SELECT COUNT(*) FROM consultations) AS consultations,
                NULL AS medical_records,
                (SELECT COUNT(*) FROM medicines) AS medicines,
                (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
                (SELECT COUNT(*) FROM prescription_items) AS prescription_items,
                (SELECT COUNT(*) FROM audit_logs) AS audit_logs;
            """
        )

    recent_backups = await fetch_all(
        "SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 5;"
    )

    # Daftar snapshot PITR tersedia
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
# GET /api/drp/snapshots — Daftar semua snapshot PITR
# ============================================================
@router.get("/snapshots")
async def list_snapshots(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """Daftar semua snapshot PITR yang tersedia."""
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
# POST /api/drp/snapshot — Buat snapshot PITR pre-incident
# ============================================================
@router.post("/snapshot")
async def create_snapshot(
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Buat snapshot PITR (Point-in-Time Recovery) menggunakan pg_dump.
    Gunakan sebelum operasi kritis sebagai titik pemulihan.
    """
    os.makedirs(PITR_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    snapshot_id = f"PITR_{timestamp}"
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
        details=f"PITR snapshot dibuat: {snapshot_id} ({size_bytes} bytes).",
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
        "message": f"Snapshot PITR berhasil dibuat. Gunakan ID ini untuk recovery: {snapshot_id}",
    }


# ============================================================
# POST /api/drp/simulate-drop — [DEMO] Simulasi DROP TABLE
# ============================================================
@router.post("/simulate-drop")
async def simulate_drop_table(
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    [DEMO] Simulasi human error: DROP TABLE medical_records.
    PERINGATAN: Ini BENAR-BENAR menghapus tabel dari database!
    Gunakan hanya setelah membuat snapshot PITR terlebih dahulu.
    """
    count_row = await fetch_one("SELECT COUNT(*) AS cnt FROM medical_records;")
    records_before = count_row["cnt"] if count_row else 0

    # Eksekusi DROP TABLE sungguhan
    await execute("DROP TABLE IF EXISTS medical_records CASCADE;")

    await audit(
        request=request, user=current_user,
        action="DELETE", table="medical_records", record_id=None,
        severity="danger",
        details=f"[DR TEST] Simulasi human error: DROP TABLE medical_records CASCADE. "
                f"{records_before} rekam medis HILANG.",
    )

    return {
        "success": True,
        "incident": "DROP TABLE medical_records CASCADE",
        "records_lost": records_before,
        "medical_records_table_exists": False,
        "message": "INSIDEN SIMULASI: Tabel medical_records telah dihapus! "
                   "Segera lakukan recovery menggunakan snapshot PITR.",
        "next_step": "POST /api/drp/recover/{snapshot_id}",
    }


# ============================================================
# POST /api/drp/recover/{snapshot_id} — Recovery dari snapshot
# ============================================================
@router.post("/recover/{snapshot_id}")
async def recover_from_snapshot(
    snapshot_id: str,
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Lakukan Point-in-Time Recovery dari snapshot PITR yang ditentukan.
    Menggunakan pg_restore untuk memulihkan database dari dump.
    """
    file_path = os.path.join(PITR_DIR, f"{snapshot_id}.dump")
    meta_path = os.path.join(PITR_DIR, f"{snapshot_id}.meta")

    if not os.path.exists(file_path):
        available = []
        if os.path.isdir(PITR_DIR):
            available = [f.replace(".meta", "") for f in os.listdir(PITR_DIR) if f.endswith(".meta")]
        raise HTTPException(
            status_code=404,
            detail=f"Snapshot '{snapshot_id}' tidak ditemukan. Tersedia: {available}",
        )

    # Baca metadata pre-incident
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path) as mf:
            for line in mf:
                line = line.strip()
                if "=" in line:
                    k, v = line.split("=", 1)
                    meta[k] = v

    pre_medical_records = int(meta.get("pre_incident_medical_records", 0))

    # Catat di backup_runs
    run_row = await fetch_one(
        """
        INSERT INTO backup_runs (kind, status, file_name, triggered_by, started_at)
        VALUES ('snapshot', 'running', %s, %s, NOW())
        RETURNING id;
        """,
        (f"{snapshot_id}.dump (RESTORE)", current_user.get("username", "admin")),
    )
    run_id = run_row["id"]

    # Eksekusi pg_restore
    env = os.environ.copy()
    env["PGPASSWORD"] = settings.PGPASSWORD
    cmd = [
        "pg_restore",
        "-h", settings.PGHOST,
        "-p", str(settings.PGPORT),
        "-U", settings.PGUSER,
        "-d", settings.PGDATABASE,
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        file_path,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=180.0)
    except asyncio.TimeoutError:
        await execute(
            "UPDATE backup_runs SET status='failed', finished_at=NOW() WHERE id=%s;",
            (run_id,),
        )
        raise HTTPException(status_code=500, detail="pg_restore timeout")

    stderr_text = stderr.decode().strip() if stderr else ""

    # Verifikasi hasil recovery
    table_check = await fetch_one(
        """
        SELECT COUNT(*) AS cnt
        FROM information_schema.tables
        WHERE table_schema='public' AND table_name='medical_records';
        """
    )
    table_restored = (table_check["cnt"] > 0) if table_check else False

    recovered_count = 0
    if table_restored:
        count_row = await fetch_one("SELECT COUNT(*) AS cnt FROM medical_records;")
        recovered_count = count_row["cnt"] if count_row else 0

    if os.path.exists(meta_path):
        with open(meta_path, "a") as mf:
            mf.write(f"recovery_status={'BERHASIL' if table_restored else 'GAGAL'}\n")
            mf.write(f"recovery_timestamp={datetime.now().strftime('%Y%m%d_%H%M%S')}\n")
            mf.write(f"recovered_medical_records={recovered_count}\n")

    if table_restored:
        await execute(
            "UPDATE backup_runs SET status='success', finished_at=NOW() WHERE id=%s;",
            (run_id,),
        )
        await audit(
            request=request, user=current_user,
            action="RESTORE", table="medical_records", record_id=None,
            severity="success",
            details=f"[DR TEST] PITR Recovery BERHASIL dari snapshot {snapshot_id}. "
                    f"medical_records dipulihkan: {recovered_count} rekaman.",
        )
        return {
            "success": True,
            "snapshot_id": snapshot_id,
            "recovery_status": "BERHASIL",
            "medical_records_table_exists": True,
            "recovered_records": recovered_count,
            "pre_incident_records": pre_medical_records,
            "data_loss": pre_medical_records - recovered_count,
            "rpo_achieved": (pre_medical_records - recovered_count) == 0,
            "message": f"Recovery BERHASIL! {recovered_count} rekam medis dipulihkan dari snapshot {snapshot_id}.",
            "stderr_warnings": stderr_text[:500] if stderr_text else None,
        }
    else:
        await execute(
            "UPDATE backup_runs SET status='failed', finished_at=NOW() WHERE id=%s;",
            (run_id,),
        )
        raise HTTPException(
            status_code=500,
            detail=f"pg_restore dijalankan tapi tabel medical_records belum kembali. "
                   f"stderr: {stderr_text[:300]}",
        )

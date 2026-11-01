import asyncio
import os
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.audit import audit
from app.config import settings
from app.db import execute, fetch_all, fetch_one
from app.security import require_roles

router = APIRouter()


@router.get("")
async def get_backup_overview(
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Overview Disaster Recovery & Backup (khusus admin).
    Menampilkan konfigurasi backup_config, daftar storage nodes, dan 10 riwayat backup_runs terakhir.
    """
    config = await fetch_one("SELECT * FROM backup_config ORDER BY id ASC LIMIT 1;")
    nodes = []
    if config:
        nodes = await fetch_all(
            "SELECT * FROM backup_nodes WHERE config_id = %s ORDER BY id ASC;",
            (config["id"],),
        )

    recent_runs = await fetch_all(
        "SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 10;"
    )

    return {
        "config": config,
        "nodes": nodes,
        "recent_runs": recent_runs,
    }


@router.post("/trigger")
async def trigger_manual_backup(
    request: Request,
    current_user: dict[str, Any] = Depends(require_roles("admin")),
):
    """
    Memicu backup database menggunakan pg_dump -Fc SUNGGUHAN.
    Ukuran file dicatat dari os.stat (tanpa angka acak/palsu).
    Batas waktu eksekusi: 120 detik.
    """
    dump_dir = "/backups/dump"
    os.makedirs(dump_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"telemed_{timestamp}.dump"
    file_path = os.path.join(dump_dir, file_name)

    triggered_by = current_user.get("user_name") or current_user.get("username", "admin")

    # 1. Catat status running di tabel backup_runs
    run_row = await fetch_one(
        """
        INSERT INTO backup_runs (kind, status, file_name, triggered_by, started_at)
        VALUES ('dump', 'running', %s, %s, NOW())
        RETURNING id;
        """,
        (file_name, triggered_by),
    )
    run_id = run_row["id"]

    # 2. Siapkan environment untuk pg_dump
    env = os.environ.copy()
    env["PGPASSWORD"] = settings.PGPASSWORD

    cmd = [
        "pg_dump",
        "-Fc",
        "-h", settings.PGHOST,
        "-p", str(settings.PGPORT),
        "-U", settings.PGUSER,
        "-d", settings.PGDATABASE,
        "-f", file_path,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120.0)

    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        await execute(
            "UPDATE backup_runs SET status = 'failed', finished_at = NOW() WHERE id = %s;",
            (run_id,),
        )
        await audit(
            request=request,
            user=current_user,
            action="BACKUP",
            table="backup_runs",
            record_id=run_id,
            severity="danger",
            details=f"Backup dump gagal: proses pg_dump timeout (> 120 detik) untuk file {file_name}.",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Proses backup pg_dump melebihi batas waktu (timeout 120 detik)",
        )
    except Exception as exc:
        await execute(
            "UPDATE backup_runs SET status = 'failed', finished_at = NOW() WHERE id = %s;",
            (run_id,),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengeksekusi pg_dump: {exc}",
        )

    if proc.returncode != 0:
        err_msg = stderr.decode().strip()
        await execute(
            "UPDATE backup_runs SET status = 'failed', finished_at = NOW() WHERE id = %s;",
            (run_id,),
        )
        await audit(
            request=request,
            user=current_user,
            action="BACKUP",
            table="backup_runs",
            record_id=run_id,
            severity="danger",
            details=f"Backup pg_dump gagal (returncode={proc.returncode}): {err_msg}.",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"pg_dump mengembalikan error: {err_msg}",
        )

    # 3. Ambil ukuran file dump SUNGGUHAN dari filesystem
    try:
        file_stat = os.stat(file_path)
        size_bytes = file_stat.st_size
    except Exception as exc:
        size_bytes = 0

    # 4. Update status success pada backup_runs & perbarui last_backup pada backup_config
    await execute(
        """
        UPDATE backup_runs
        SET status = 'success',
            size_bytes = %s,
            finished_at = NOW()
        WHERE id = %s;
        """,
        (size_bytes, run_id),
    )
    await execute("UPDATE backup_config SET last_backup = NOW();")

    await audit(
        request=request,
        user=current_user,
        action="BACKUP",
        table="backup_runs",
        record_id=run_id,
        severity="success",
        details=f"Backup pg_dump berhasil dibuat: {file_name} ({size_bytes} bytes).",
    )

    return {
        "status": "success",
        "file_name": file_name,
        "size_bytes": size_bytes,
        "run_id": run_id,
        "message": "Backup database format dump kustom (-Fc) berhasil dibuat.",
    }

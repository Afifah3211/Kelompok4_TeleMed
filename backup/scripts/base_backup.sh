#!/usr/bin/env bash
# ============================================================
# TeleMed - Base Backup Script (pg_basebackup)
# Strategi DRP: Base backup harian pukul 01:00 WIB (retensi 7 hari)
# Menghasilkan tar.gz base backup fisik sebagai dasar PITR.
# ============================================================
set -euo pipefail

if [ -f /etc/environment ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(PG|POSTGRES_|TZ|PATH)' /etc/environment | xargs -d '\n') 2>/dev/null || true
fi

PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-telemed_admin}"
PGDATABASE="${PGDATABASE:-telemed}"
export PGPASSWORD="${PGPASSWORD:-medisync2026}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BaseBackup] $*"
}

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
TARGET_DIR="/backups/base/${TIMESTAMP}"
mkdir -p "$TARGET_DIR"

log "Memulai pg_basebackup dari '$PGHOST:$PGPORT' ke '$TARGET_DIR'..."

# Catat status awal 'running' di backup_runs
RUN_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -A -c \
  "INSERT INTO backup_runs (kind, status, file_name, triggered_by, started_at) \
   VALUES ('base', 'running', '${TIMESTAMP}/base.tar.gz', 'backup_job_cron', NOW()) \
   RETURNING id;" 2>/dev/null || echo "")

cleanup_on_error() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    log "ERROR: pg_basebackup gagal (exit code: $exit_code)!"
    if [ -n "$RUN_ID" ]; then
      psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
        "UPDATE backup_runs SET status = 'failed', finished_at = NOW() WHERE id = $RUN_ID;" 2>/dev/null || true
    fi
    rm -rf "$TARGET_DIR"
  fi
  exit $exit_code
}
trap cleanup_on_error EXIT

# Eksekusi pg_basebackup dengan kompresi gzip (-Ft -z) tanpa menyertakan WAL (-X none)
# karena WAL sudah diarsipkan secara kontinu ke volume wal_archive
pg_basebackup -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -D "$TARGET_DIR" -Ft -z -X none

# Hitung ukuran total hasil base backup
SIZE_BYTES=0
for f in "$TARGET_DIR"/*; do
  if [ -f "$f" ]; then
    s=$(stat -c %s "$f")
    SIZE_BYTES=$((SIZE_BYTES + s))
  fi
done

if [ "$SIZE_BYTES" -le 0 ]; then
  log "ERROR: Direktori hasil base backup kosong!"
  exit 1
fi

SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN { printf "%.2f", b / (1024 * 1024) }')
log "Base backup BERHASIL: $TARGET_DIR ($SIZE_BYTES bytes / $SIZE_MB MB)"

# Perbarui tabel backup_runs & backup_config
if [ -n "$RUN_ID" ]; then
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
    "UPDATE backup_runs SET status = 'success', size_bytes = $SIZE_BYTES, finished_at = NOW() WHERE id = $RUN_ID; \
     UPDATE backup_config SET last_backup = NOW();" 2>/dev/null || true
fi

# Reset trap
trap - EXIT

# Jalankan sinkronisasi enkripsi off-site segera setelah backup selesai
log "Memicu sinkronisasi enkripsi off-site..."
/scripts/sync_offsite.sh || log "Peringatan: sync_offsite mengembalikan status non-zero."

log "Selesai eksekusi base backup."

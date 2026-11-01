#!/usr/bin/env bash
# ============================================================
# TeleMed - Logical Backup Script (pg_dump -Fc)
# Strategi DRP: Dump logis tiap 6 jam (retensi 7 hari)
# ============================================================
set -euo pipefail

# Muat environment jika dijalankan dalam sub-shell cron
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
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DumpLogis] $*"
}

mkdir -p /backups/dump

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
FILE_NAME="telemed_${TIMESTAMP}.dump"
TARGET_FILE="/backups/dump/${FILE_NAME}"

log "Memulai dump logis database '$PGDATABASE' pada host '$PGHOST:$PGPORT'..."

# Catat status awal 'running' pada tabel backup_runs
RUN_ID=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -A -c \
  "INSERT INTO backup_runs (kind, status, file_name, triggered_by, started_at) \
   VALUES ('dump', 'running', '$FILE_NAME', 'backup_job_cron', NOW()) \
   RETURNING id;" 2>/dev/null || echo "")

cleanup_on_error() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    log "ERROR: Dump logis gagal (exit code: $exit_code)!"
    if [ -n "$RUN_ID" ]; then
      psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
        "UPDATE backup_runs SET status = 'failed', finished_at = NOW() WHERE id = $RUN_ID;" 2>/dev/null || true
    fi
    rm -f "$TARGET_FILE"
  fi
  exit $exit_code
}
trap cleanup_on_error EXIT

# Eksekusi pg_dump format custom (-Fc)
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$TARGET_FILE"

# Validasi keberadaan dan ukuran file nyata
if [ ! -s "$TARGET_FILE" ]; then
  log "ERROR: Berkas dump kosong atau tidak terbentuk!"
  exit 1
fi

SIZE_BYTES=$(stat -c %s "$TARGET_FILE")
SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN { printf "%.2f", b / (1024 * 1024) }')

log "Dump logis BERHASIL: $FILE_NAME ($SIZE_BYTES bytes / $SIZE_MB MB)"

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

log "Selesai eksekusi dump logis."

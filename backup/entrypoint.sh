#!/usr/bin/env bash
# ============================================================
# TeleMed - Backup Daemon Entrypoint
# Memasang cron schedule, mengekspor environment variables,
# dan menjalankan cron service di foreground.
# ============================================================
set -euo pipefail

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Entrypoint] $*"
}

log "Memulai inisialisasi Backup Job daemon..."

# Pastikan direktori volume lokal & offsite siap (termasuk pitr untuk backend)
mkdir -p /backups/dump /backups/base /backups/pitr /offsite/dump /offsite/base /offsite/wal /wal_archive
# Beri izin tulis ke semua user agar container backend (user: telemed) bisa akses
chmod -R 777 /backups /wal_archive

# Ekspor environment variables ke /etc/environment agar dapat dibaca oleh proses cron
log "Mengekspor variabel lingkungan PG* & TZ ke /etc/environment..."
printenv | grep -E '^(PG|POSTGRES_|TZ|PATH)' > /etc/environment || true

# Terapkan crontab
log "Memasang crontab dari /etc/cron.d/backup_cron..."
crontab /etc/cron.d/backup_cron

log "Crontab terpasang dengan jadwal:"
crontab -l | grep -v '^#' | grep -v '^$' || true

log "Backup Job Daemon aktif. Menjalankan cron di foreground..."
exec cron -f

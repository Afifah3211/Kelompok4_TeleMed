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
# Backend membutuhkan akses tulis ke direktori snapshot PITR pada volume backups.
# Volume wal_archive dipasang read-only; jangan chmod volume tersebut.
chmod -R 777 /backups

# Ekspor environment variables ke /etc/environment agar dapat dibaca oleh proses cron
log "Mengekspor variabel lingkungan PG* & TZ ke /etc/environment..."
printenv | grep -E '^(PG|POSTGRES_|TZ|PATH)' > /etc/environment || true

# Cron Debian membaca jadwal sistem langsung dari /etc/cron.d.
log "Jadwal backup terpasang dari /etc/cron.d/backup_cron:"
grep -v '^#' /etc/cron.d/backup_cron | grep -v '^$' || true

log "Backup Job Daemon aktif. Menjalankan cron di foreground..."
exec cron -f

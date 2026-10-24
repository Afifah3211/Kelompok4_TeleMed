#!/bin/sh
# ============================================================
# MediSync DRP - Manual Backup Script
# Fungsi: Buat backup snapshot database on-demand (manual)
# Penggunaan:
#   docker exec medisync_drp_backup sh /scripts/backup-now.sh
# ============================================================

set -e

BACKUP_DIR="/data/backups"
DB_FILE="/data/db/medisync.db"
LOG_FILE="$BACKUP_DIR/backup_log.txt"

log() {
  MSG="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$MSG"
  echo "$MSG" >> "$LOG_FILE"
}

log "=== MEDISYNC MANUAL BACKUP DIMULAI ==="

# Pastikan database tersedia
if [ ! -f "$DB_FILE" ]; then
  log "ERROR: Database tidak ditemukan di $DB_FILE"
  exit 1
fi

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/medisync_manual_$TIMESTAMP.db"

log "Sumber    : $DB_FILE"
log "Tujuan    : $BACKUP_FILE"

# SQLite hot backup (safe saat database aktif digunakan)
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Verifikasi backup
if sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "Backup BERHASIL. Ukuran: $SIZE"
  log "File: $BACKUP_FILE"
else
  log "ERROR: Backup gagal — integritas tidak valid!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Tampilkan semua backup yang ada
log "--- Daftar Backup Tersimpan ---"
ls -lh "$BACKUP_DIR"/*.db 2>/dev/null | while read LINE; do
  log "  $LINE"
done

log "=== BACKUP SELESAI ==="

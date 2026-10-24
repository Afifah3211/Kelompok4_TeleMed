#!/bin/sh
# ============================================================
# MediSync DRP - Database Recovery Script
# Fungsi: Restore database SQLite dari backup snapshot
# Penggunaan:
#   docker exec medisync_drp_backup sh /scripts/restore.sh [BACKUP_FILE]
#   Contoh:
#   docker exec medisync_drp_backup sh /scripts/restore.sh medisync_drp_20261024_020000.db
# ============================================================

set -e

BACKUP_DIR="/data/backups"
DB_DIR="/data/db"
TARGET_DB="$DB_DIR/medisync.db"
LOG_FILE="/data/backups/recovery_log.txt"

log() {
  MSG="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$MSG"
  echo "$MSG" >> "$LOG_FILE"
}

log "=== MEDISYNC DRP RECOVERY DIMULAI ==="

# ── Validasi argumen ─────────────────────────────────────────
if [ -z "$1" ]; then
  log "ERROR: Nama file backup tidak diberikan."
  log "Daftar backup tersedia:"
  ls -lh "$BACKUP_DIR"/*.db 2>/dev/null || log "  (tidak ada backup)"
  log "Penggunaan: sh /scripts/restore.sh [NAMA_FILE_BACKUP.db]"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [ ! -f "$BACKUP_FILE" ]; then
  log "ERROR: File backup tidak ditemukan: $BACKUP_FILE"
  log "Backup tersedia:"
  ls -lh "$BACKUP_DIR"/*.db 2>/dev/null || log "  (tidak ada)"
  exit 1
fi

# ── Verifikasi integritas backup dengan SQLite ───────────────
log "Memverifikasi integritas file backup: $BACKUP_FILE"
if sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
  log "Integritas backup: OK"
else
  log "ERROR: File backup rusak! Integritas tidak valid."
  exit 1
fi

# ── Buat snapshot database saat ini (keamanan sebelum restore) ─
PRE_RESTORE_SNAP="$BACKUP_DIR/pre_restore_$(date '+%Y%m%d_%H%M%S').db"
if [ -f "$TARGET_DB" ]; then
  log "Menyimpan snapshot database saat ini ke: $PRE_RESTORE_SNAP"
  sqlite3 "$TARGET_DB" ".backup '$PRE_RESTORE_SNAP'"
  log "Snapshot pre-restore berhasil dibuat."
fi

# ── Restore: salin backup ke lokasi database aktif ───────────
log "Memulai restore dari: $BACKUP_FILE → $TARGET_DB"
cp "$BACKUP_FILE" "$TARGET_DB"
log "File database berhasil di-restore."

# ── Verifikasi database hasil restore ───────────────────────
log "Memverifikasi database hasil restore..."
USER_COUNT=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "ERROR")
CONSULT_COUNT=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM consultations;" 2>/dev/null || echo "ERROR")
RECORDS_COUNT=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM medical_records;" 2>/dev/null || echo "ERROR")

log "--- Hasil Verifikasi Restore ---"
log "  Total Users       : $USER_COUNT"
log "  Total Konsultasi  : $CONSULT_COUNT"
log "  Total Rekam Medis : $RECORDS_COUNT"

if [ "$USER_COUNT" = "ERROR" ]; then
  log "ERROR: Database restore gagal diverifikasi!"
  exit 1
fi

log "=== RECOVERY BERHASIL ==="
log "Database di-restore dari: $1"
log "Silakan restart container backend agar perubahan terbaca:"
log "  docker restart medisync_backend"

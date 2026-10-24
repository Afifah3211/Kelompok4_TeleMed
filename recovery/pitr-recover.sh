#!/bin/sh
# ============================================================
# MediSync DRP - PITR Recovery Script
# Skenario: Pemulihan setelah "Human Error - DROP TABLE"
#
# Script ini:
#   1. Memvalidasi snapshot PITR yang diminta
#   2. Membandingkan data sebelum vs sesudah insiden
#   3. Melakukan Point-in-Time Recovery
#   4. Memverifikasi keberhasilan recovery
#   5. Mencatat audit log pemulihan
#
# Penggunaan:
#   docker exec medisync_drp_backup sh /scripts/pitr-recover.sh PITR_20261024_020000
# ============================================================

set -e

BACKUP_DIR="/data/backups"
DB_FILE="/data/db/medisync.db"
PITR_DIR="$BACKUP_DIR/pitr"
LOG_FILE="$BACKUP_DIR/pitr_log.txt"

log() {
  MSG="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$MSG"
  echo "$MSG" >> "$LOG_FILE"
}

log "========================================================"
log "  MEDISYNC DRP - POINT-IN-TIME RECOVERY (PITR)"
log "  Skenario: Human Error - DROP TABLE medical_records"
log "========================================================"

# ── Validasi argumen ─────────────────────────────────────────
if [ -z "$1" ]; then
  log "ERROR: Snapshot ID tidak diberikan."
  log "Snapshot PITR tersedia:"
  ls "$PITR_DIR"/*.meta 2>/dev/null | while read F; do
    ID=$(basename "$F" .meta)
    TS=$(grep "timestamp=" "$F" | cut -d= -f2)
    MR=$(grep "pre_incident_medical_records=" "$F" | cut -d= -f2)
    log "  - $ID (waktu: $TS, rekam medis: $MR)"
  done
  log "Penggunaan: sh /scripts/pitr-recover.sh [SNAPSHOT_ID]"
  exit 1
fi

SNAPSHOT_ID="$1"
SNAPSHOT_FILE="$PITR_DIR/${SNAPSHOT_ID}.db"
META_FILE="$PITR_DIR/${SNAPSHOT_ID}.meta"

# ── Validasi file snapshot ───────────────────────────────────
if [ ! -f "$SNAPSHOT_FILE" ]; then
  log "ERROR: Snapshot tidak ditemukan: $SNAPSHOT_FILE"
  exit 1
fi

if [ ! -f "$META_FILE" ]; then
  log "PERINGATAN: File metadata tidak ditemukan, melanjutkan tanpa verifikasi metadata."
fi

# ── Baca metadata pre-incident ───────────────────────────────
if [ -f "$META_FILE" ]; then
  PRE_RECORDS=$(grep "pre_incident_medical_records=" "$META_FILE" | cut -d= -f2)
  PRE_USERS=$(grep "pre_incident_users=" "$META_FILE" | cut -d= -f2)
  PRE_TIME=$(grep "timestamp=" "$META_FILE" | cut -d= -f2)
  log "Snapshot dibuat pada    : $PRE_TIME"
  log "Rekam medis saat snapshot: $PRE_RECORDS"
  log "Users saat snapshot     : $PRE_USERS"
fi

# ── Ambil kondisi database SAAT INI (post-incident) ─────────
log ""
log "--- KONDISI DATABASE SAAT INI (POST-INCIDENT) ---"

# Cek apakah tabel medical_records masih ada
TABLE_EXISTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='medical_records';" 2>/dev/null || echo "0")

if [ "$TABLE_EXISTS" = "0" ]; then
  log "  KRITIS: Tabel medical_records TIDAK DITEMUKAN! (DROP TABLE terjadi)"
  POST_RECORDS="0 (TABEL DIHAPUS)"
else
  POST_RECORDS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM medical_records;" 2>/dev/null || echo "0")
  log "  Rekam medis saat ini: $POST_RECORDS"
fi

POST_USERS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "N/A")
log "  Users saat ini      : $POST_USERS"

# ── Verifikasi integritas snapshot ───────────────────────────
log ""
log "Memverifikasi integritas snapshot PITR..."
INTEGRITY=$(sqlite3 "$SNAPSHOT_FILE" "PRAGMA integrity_check;" 2>/dev/null)
if echo "$INTEGRITY" | grep -q "ok"; then
  log "Integritas snapshot: OK — AMAN untuk recovery"
else
  log "ERROR: Snapshot rusak! Tidak dapat melakukan recovery."
  exit 1
fi

# ── Safety snapshot: backup kondisi saat ini sebelum overwrite ─
SAFETY_FILE="$BACKUP_DIR/pre_pitr_recovery_$(date '+%Y%m%d_%H%M%S').db"
log ""
log "Membuat safety backup kondisi saat ini ke: $SAFETY_FILE"
sqlite3 "$DB_FILE" ".backup '$SAFETY_FILE'" 2>/dev/null || true
log "Safety backup dibuat."

# ── POINT-IN-TIME RECOVERY ───────────────────────────────────
log ""
log "========================================================"
log "  MEMULAI POINT-IN-TIME RECOVERY..."
log "  Sumber: $SNAPSHOT_FILE"
log "  Target: $DB_FILE"
log "========================================================"

cp "$SNAPSHOT_FILE" "$DB_FILE"
log "Recovery selesai. Database dipulihkan ke titik: $PRE_TIME"

# ── Verifikasi hasil recovery ────────────────────────────────
log ""
log "--- VERIFIKASI PASCA-RECOVERY ---"
RECOVERED_RECORDS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM medical_records;" 2>/dev/null || echo "ERROR")
RECOVERED_USERS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "ERROR")
RECOVERED_CONSULTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM consultations;" 2>/dev/null || echo "ERROR")
INTEGRITY_POST=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null)

log "  Rekam medis setelah recovery : $RECOVERED_RECORDS (sebelum insiden: $PRE_RECORDS)"
log "  Users setelah recovery       : $RECOVERED_USERS"
log "  Konsultasi setelah recovery  : $RECOVERED_CONSULTS"

if echo "$INTEGRITY_POST" | grep -q "ok"; then
  log "  Integritas database pasca-recovery: OK"
else
  log "  PERINGATAN: Integritas database pasca-recovery mencurigakan!"
fi

# ── Validasi: apakah recovery berhasil? ─────────────────────
if [ "$RECOVERED_RECORDS" = "$PRE_RECORDS" ] 2>/dev/null; then
  RECOVERY_STATUS="BERHASIL SEMPURNA"
elif [ -n "$RECOVERED_RECORDS" ] && [ "$RECOVERED_RECORDS" != "ERROR" ]; then
  RECOVERY_STATUS="BERHASIL (data terpulihkan)"
else
  RECOVERY_STATUS="GAGAL"
fi

log ""
log "========================================================"
log "  STATUS RECOVERY  : $RECOVERY_STATUS"
log "  Snapshot PITR ID : $SNAPSHOT_ID"
log "  Waktu Snapshot   : ${PRE_TIME:-N/A}"
log "========================================================"
log ""
log "LANGKAH SELANJUTNYA:"
log "  Restart backend agar membaca database yang sudah di-recover:"
log "  docker restart medisync_backend"
log ""

# Tandai metadata snapshot sebagai sudah digunakan
if [ -f "$META_FILE" ]; then
  echo "recovery_status=$RECOVERY_STATUS" >> "$META_FILE"
  echo "recovery_timestamp=$(date '+%Y%m%d_%H%M%S')" >> "$META_FILE"
fi

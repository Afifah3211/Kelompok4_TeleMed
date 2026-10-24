#!/bin/sh
# ============================================================
# MediSync DRP - Point-in-Time Recovery (PITR) Script
# Skenario: "Human Error - DROP TABLE medical_records"
#
# Prosedur ini mensimulasikan dan memulihkan insiden:
#   Seseorang secara tidak sengaja menghapus tabel rekam medis.
#   Script ini melakukan recovery ke titik SEBELUM insiden.
#
# Penggunaan:
#   # STEP 1 - Jalankan sebelum insiden (ambil snapshot PITR)
#   docker exec medisync_drp_backup sh /scripts/pitr-snapshot.sh
#
#   # STEP 2 - Simulasikan insiden (drop table)
#   docker exec medisync_backend node /app/db/simulate-incident.js
#
#   # STEP 3 - Recover ke titik sebelum insiden
#   docker exec medisync_drp_backup sh /scripts/pitr-recover.sh [SNAPSHOT_ID]
#
# ============================================================

set -e

BACKUP_DIR="/data/backups"
DB_FILE="/data/db/medisync.db"
PITR_DIR="$BACKUP_DIR/pitr"
LOG_FILE="$BACKUP_DIR/pitr_log.txt"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

log() {
  MSG="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$MSG"
  echo "$MSG" >> "$LOG_FILE"
}

log "========================================================"
log "  MEDISYNC PITR - MEMBUAT SNAPSHOT PRE-INCIDENT"
log "========================================================"

# Buat direktori PITR
mkdir -p "$PITR_DIR"

if [ ! -f "$DB_FILE" ]; then
  log "ERROR: Database tidak ditemukan di $DB_FILE"
  exit 1
fi

# ── Checkpoint WAL sebelum snapshot ─────────────────────────
# Pastikan semua transaksi WAL sudah di-flush ke file utama
log "Melakukan WAL checkpoint untuk konsistensi data..."
sqlite3 "$DB_FILE" "PRAGMA wal_checkpoint(TRUNCATE);"
log "WAL checkpoint selesai."

# ── Ambil statistik sebelum insiden ─────────────────────────
USERS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
RECORDS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM medical_records WHERE is_deleted=0;" 2>/dev/null || echo "0")
CONSULTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM consultations;" 2>/dev/null || echo "0")
LOGS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM audit_logs;" 2>/dev/null || echo "0")

log "--- STATISTIK DATABASE (PRE-INCIDENT) ---"
log "  Users              : $USERS"
log "  Rekam Medis Aktif  : $RECORDS"
log "  Konsultasi         : $CONSULTS"
log "  Audit Logs         : $LOGS"

# ── Buat snapshot PITR dengan ID unik ───────────────────────
SNAPSHOT_ID="PITR_${TIMESTAMP}"
SNAPSHOT_FILE="$PITR_DIR/${SNAPSHOT_ID}.db"

sqlite3 "$DB_FILE" ".backup '$SNAPSHOT_FILE'"
log "Snapshot PITR berhasil: $SNAPSHOT_FILE"

# ── Verifikasi integritas snapshot ───────────────────────────
INTEGRITY=$(sqlite3 "$SNAPSHOT_FILE" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
if echo "$INTEGRITY" | grep -q "ok"; then
  log "Integritas snapshot: OK"
else
  log "ERROR: Snapshot rusak! Integritas gagal."
  rm -f "$SNAPSHOT_FILE"
  exit 1
fi

# ── Simpan metadata snapshot ─────────────────────────────────
META_FILE="$PITR_DIR/${SNAPSHOT_ID}.meta"
cat > "$META_FILE" << EOF
snapshot_id=$SNAPSHOT_ID
timestamp=$TIMESTAMP
db_file=$DB_FILE
snapshot_file=$SNAPSHOT_FILE
pre_incident_users=$USERS
pre_incident_medical_records=$RECORDS
pre_incident_consultations=$CONSULTS
pre_incident_audit_logs=$LOGS
status=CLEAN_SNAPSHOT
EOF
log "Metadata snapshot disimpan: $META_FILE"

echo ""
log "========================================================"
log "  SNAPSHOT PITR SIAP. ID: $SNAPSHOT_ID"
log "  Gunakan ID ini untuk recovery setelah insiden:"
log "  sh /scripts/pitr-recover.sh $SNAPSHOT_ID"
log "========================================================"
echo ""
echo "PITR_SNAPSHOT_ID=$SNAPSHOT_ID"

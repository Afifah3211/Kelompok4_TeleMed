#!/usr/bin/env bash
# ============================================================
# TeleMed - Daily Health & Integrity Verification Script
# Sesuai Lampiran C Dokumen Arsitektur & DRP
# Memeriksa:
# 1. Ketersediaan & integritas backup terbaru (ukuran > 0)
# 2. Status WAL archiving (berkas bertambah > 0)
# 3. Kapasitas ruang disk penyimpanan (< 80%)
# Menuliskan ringkasan status ke /backups/check.log
# ============================================================
set -euo pipefail

LOG_FILE="/backups/check.log"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [DailyCheck] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

mkdir -p /backups
touch "$LOG_FILE"

log "============================================================"
log "MEMULAI PEMERIKSAAN HARIAN INTEGRITAS BACKUP & DISASTER RECOVERY"
log "============================================================"

all_passed=true

# 1. Periksa Backup Terbaru
log "Memeriksa ketersediaan berkas backup terbaru..."
latest_dump=$(find /backups/dump -type f -name "*.dump" -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || true)
latest_base=$(find /backups/base -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || true)

if [ -n "$latest_dump" ] && [ -s "$latest_dump" ]; then
  dump_size=$(stat -c %s "$latest_dump")
  log "[OK] Dump logis terbaru ditemukan: $(basename "$latest_dump") ($dump_size bytes)"
else
  log "[FAIL] Tidak ada berkas dump logis yang valid di /backups/dump!"
  all_passed=false
fi

if [ -n "$latest_base" ] && [ -d "$latest_base" ]; then
  log "[OK] Direktori base backup terbaru ditemukan: $(basename "$latest_base")"
else
  log "[WARN] Belum ada base backup harian di /backups/base."
fi

# 2. Periksa WAL Archiving
log "Memeriksa kontinuitas WAL archiving..."
wal_count=$(find /wal_archive -type f 2>/dev/null | wc -l)
if [ "$wal_count" -gt 0 ]; then
  log "[OK] WAL archive aktif: $wal_count segmen WAL tersimpan di /wal_archive"
else
  log "[FAIL] Tidak ada segmen WAL yang ditemukan di /wal_archive!"
  all_passed=false
fi

# 3. Periksa Kapasitas Disk (< 80%)
log "Memeriksa kapasitas ruang penyimpanan disk..."
disk_usage=$(df -P /backups | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$disk_usage" -lt 80 ]; then
  log "[OK] Kapasitas disk /backups aman: ${disk_usage}% (di bawah ambang batas 80%)"
else
  log "[FAIL] Kapasitas disk /backups kritis: ${disk_usage}% (>= 80%)!"
  all_passed=false
fi

# 4. Ringkasan Akhir
if [ "$all_passed" = true ]; then
  log "STATUS: SEMUA PEMERIKSAAN HARIAN BERHASIL (SEHAT & AMAN)"
  log "============================================================"
  exit 0
else
  log "STATUS: TERDAPAT PEMERIKSAAN YANG GAGAL! PERIKSA LOG DI ATAS"
  log "============================================================"
  exit 1
fi

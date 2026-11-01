#!/usr/bin/env bash
# ============================================================
# TeleMed - Retention & Cleanup Script
# Kebijakan Retensi DRP:
# - Backup lokal (/backups/dump dan /backups/base): Retensi 7 hari
# - Salinan off-site (/offsite): Retensi 30 hari
# ============================================================
set -euo pipefail

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Cleanup] $*"
}

log "Memulai pembersihan berkas backup sesuai kebijakan retensi..."

local_deleted=0
offsite_deleted=0

# 1. Bersihkan dump lokal > 7 hari
if [ -d /backups/dump ]; then
  while IFS= read -r -d '' file; do
    log "Menghapus dump logis kadaluwarsa (> 7 hari): $file"
    rm -f "$file"
    local_deleted=$((local_deleted + 1))
  done < <(find /backups/dump -type f -name "*.dump" -mtime +7 -print0 2>/dev/null)
fi

# 2. Bersihkan base backup lokal > 7 hari
if [ -d /backups/base ]; then
  while IFS= read -r -d '' dir; do
    log "Menghapus base backup kadaluwarsa (> 7 hari): $dir"
    rm -rf "$dir"
    local_deleted=$((local_deleted + 1))
  done < <(find /backups/base -mindepth 1 -maxdepth 1 -type d -mtime +7 -print0 2>/dev/null)
fi

# 3. Bersihkan berkas terenkripsi off-site > 30 hari
if [ -d /offsite ]; then
  while IFS= read -r -d '' file; do
    log "Menghapus berkas off-site kadaluwarsa (> 30 hari): $file"
    rm -f "$file"
    offsite_deleted=$((offsite_deleted + 1))
  done < <(find /offsite -type f -name "*.enc" -mtime +30 -print0 2>/dev/null)

  # Hapus direktori kosong di /offsite
  find /offsite -mindepth 2 -type d -empty -delete 2>/dev/null || true
fi

log "Pembersihan selesai: $local_deleted berkas lokal (> 7 hari) dihapus, $offsite_deleted berkas offsite (> 30 hari) dihapus."

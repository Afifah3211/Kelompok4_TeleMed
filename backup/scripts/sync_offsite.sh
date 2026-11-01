#!/usr/bin/env bash
# ============================================================
# TeleMed - Off-site Replication & AES-256 Encryption Script
# Strategi DRP 3-2-1: Salinan terenkripsi AES-256 disimpan ke
# penyimpanan terpisah (volume /offsite -> bind host ./offsite).
# ============================================================
set -euo pipefail

KEY_FILE="/run/secrets/backup_key"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SyncOffsite] $*"
}

# Verifikasi keberadaan file kunci (TIDAK PERNAH mencetak isi kunci!)
if [ ! -f "$KEY_FILE" ]; then
  log "ERROR: Kunci enkripsi tidak ditemukan di $KEY_FILE!"
  exit 1
fi

if [ ! -s "$KEY_FILE" ]; then
  log "ERROR: Kunci enkripsi di $KEY_FILE kosong (0 bytes)!"
  exit 1
fi

mkdir -p /offsite/dump /offsite/base /offsite/wal

encrypted_count=0
skipped_count=0

encrypt_file() {
  local src="$1"
  local dest_enc="$2"

  if [ ! -f "$src" ]; then
    return 0
  fi

  # Lewati jika file .enc tujuan sudah ada dan ukurannya > 0
  if [ -f "$dest_enc" ] && [ -s "$dest_enc" ]; then
    skipped_count=$((skipped_count + 1))
    return 0
  fi

  local dest_dir
  dest_dir=$(dirname "$dest_enc")
  mkdir -p "$dest_dir"

  # Enkripsi dengan AES-256-CBC, PBKDF2, dan Salt
  # Password dibaca langsung dari file secret tanpa pernah dicetak ke console / log
  if openssl enc -aes-256-cbc -pbkdf2 -salt -in "$src" -out "$dest_enc" -pass "file:$KEY_FILE" 2>/dev/null; then
    encrypted_count=$((encrypted_count + 1))
  else
    log "ERROR: Gagal mengenkripsi $src ke $dest_enc!"
    rm -f "$dest_enc"
    return 1
  fi
}

log "Memulai pemindaian dan sinkronisasi enkripsi AES-256 ke /offsite..."

# 1. Enkripsi Dump Logis (/backups/dump/*.dump -> /offsite/dump/*.dump.enc)
if [ -d /backups/dump ]; then
  for f in /backups/dump/*.dump; do
    if [ -f "$f" ]; then
      bname=$(basename "$f")
      encrypt_file "$f" "/offsite/dump/${bname}.enc"
    fi
  done
fi

# 2. Enkripsi Base Backup (/backups/base/*/* -> /offsite/base/*/*.enc)
if [ -d /backups/base ]; then
  # Temukan semua file di dalam folder base backup
  while IFS= read -r -d '' f; do
    rel_path="${f#/backups/base/}"
    encrypt_file "$f" "/offsite/base/${rel_path}.enc"
  done < <(find /backups/base -type f -print0 2>/dev/null)
fi

# 3. Enkripsi WAL Archives (/wal_archive/* -> /offsite/wal/*.enc)
# Catatan: /wal_archive di-mount read-only
if [ -d /wal_archive ]; then
  for f in /wal_archive/*; do
    if [ -f "$f" ]; then
      bname=$(basename "$f")
      # Abaikan temporary atau lock files jika ada
      if [[ "$bname" != *.tmp ]]; then
        encrypt_file "$f" "/offsite/wal/${bname}.enc"
      fi
    fi
  done
fi

log "Sinkronisasi selesai: $encrypted_count file baru terenkripsi, $skipped_count file sudah sinkron."

#!/usr/bin/env bash
# Full PostgreSQL restore rehearsal into a disposable database.
# The live TeleMed database is never modified or dropped.
set -Eeuo pipefail

PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-${POSTGRES_USER:-}}"
PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-}}"
export PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-}}"

if [[ -z "$PGUSER" || -z "$PGDATABASE" || -z "$PGPASSWORD" ]]; then
  echo "ERROR: PGUSER, PGDATABASE, and PGPASSWORD must be configured in the backup service environment." >&2
  exit 2
fi

timestamp="$(date '+%Y%m%d_%H%M%S')"
restore_db="telemed_dr_restore_${timestamp}"
dump_dir="/backups/dump"
dump_file="${dump_dir}/${PGDATABASE}_${timestamp}.dump"
keep_db="${DR_TEST_KEEP_DB:-0}"
db_created=0
started_epoch=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] [DR-Restore-Drill] $*"; }

table_inventory() {
  local database="$1"
  local table escaped count tables
  tables="$(psql -X -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$database" -At \
    -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")"
  while IFS= read -r table; do
    [[ -z "$table" ]] && continue
    escaped="${table//\"/\"\"}"
    count="$(psql -X -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$database" -At \
      -c "SELECT count(*) FROM public.\"${escaped}\";")"
    printf '%s=%s\n' "$table" "$count"
  done <<< "$tables"
}

cleanup() {
  local exit_code=$?
  if [[ "$db_created" -eq 1 && "$keep_db" != "1" ]]; then
    log "Membersihkan database latihan ${restore_db}..."
    dropdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" --if-exists "$restore_db" || \
      log "WARNING: database latihan tidak bisa dibersihkan otomatis: ${restore_db}"
  elif [[ "$db_created" -eq 1 ]]; then
    log "Database hasil restore dipertahankan untuk inspeksi: ${restore_db}"
  fi
  if [[ "$exit_code" -ne 0 ]]; then
    log "DR RESTORE DRILL GAGAL (exit ${exit_code}). Database sumber tidak diubah."
  fi
  exit "$exit_code"
}
trap cleanup EXIT

mkdir -p "$dump_dir"
log "Sumber: ${PGDATABASE}; target latihan: ${restore_db} (database terpisah, server PostgreSQL yang sama)."
log "Memeriksa koneksi ke database sumber..."
psql -X -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -At -c 'SELECT 1' >/dev/null

log "Membuat dump penuh database sumber (format custom pg_dump)."
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$dump_file"
if [[ ! -s "$dump_file" ]]; then
  log "ERROR: dump tidak ada atau kosong."
  exit 1
fi
pg_restore --list "$dump_file" >/dev/null
dump_bytes="$(stat -c %s "$dump_file")"
log "Dump tervalidasi: ${dump_file} (${dump_bytes} bytes)."

source_inventory="$(table_inventory "$PGDATABASE")"
if [[ -z "$source_inventory" ]]; then
  log "ERROR: database sumber tidak memiliki tabel public untuk divalidasi."
  exit 1
fi

# Simulasi database pemulihan yang kosong setelah database utama dianggap hilang.
# Tidak ada DROP/DELETE pada database sumber, volume pgdata, atau layanan aplikasi.
started_epoch="$(date +%s)"
log "Membuat database pemulihan kosong untuk mensimulasikan database yang hilang."
createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" --template=template0 "$restore_db"
db_created=1

log "Memulihkan seluruh dump ke database pemulihan."
pg_restore --exit-on-error --no-owner --no-privileges -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$restore_db" "$dump_file"

restored_inventory="$(table_inventory "$restore_db")"
if [[ "$source_inventory" != "$restored_inventory" ]]; then
  log "ERROR: daftar tabel/jumlah baris hasil restore tidak sama dengan snapshot."
  log "--- Snapshot ---"
  printf '%s\n' "$source_inventory"
  log "--- Hasil restore ---"
  printf '%s\n' "$restored_inventory"
  exit 1
fi

source_table_count="$(printf '%s\n' "$source_inventory" | wc -l | tr -d ' ')"
elapsed_seconds=$(( $(date +%s) - started_epoch ))
dump_time="$(date -r "$dump_file" '+%Y-%m-%d %H:%M:%S %Z')"

log "VALIDASI BERHASIL: ${source_table_count} tabel public dan jumlah baris tiap tabel sama."
log "RPO latihan: 0 perubahan sejak snapshot yang baru dibuat (bukan jaminan RPO produksi)."
log "Durasi restore + validasi (RTO drill): ${elapsed_seconds} detik. Target dokumen: 300 detik."
log "Snapshot time: ${dump_time}; dump size: ${dump_bytes} bytes."
if (( elapsed_seconds <= 300 )); then
  log "HASIL RTO: target latihan <= 5 menit tercapai."
else
  log "HASIL RTO: target latihan <= 5 menit TIDAK tercapai."
fi
log "Catatan: ini uji restore database penuh ke database terisolasi, bukan uji server mati/failover."
log "Dump bukti tersimpan pada volume backup: ${dump_file}"
if [[ "$keep_db" == "1" ]]; then
  log "DR_TEST_KEEP_DB=1; database pemulihan akan dipertahankan agar dapat diperiksa."
fi

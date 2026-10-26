#!/bin/sh
# ============================================================
# MediSync Backend - Entrypoint Script
# Tugas Pertemuan 2: Fondasi DRP
#
# Fungsi:
#   1. Pastikan direktori DB ada
#   2. Jika DB belum ada di volume → jalankan seed otomatis
#   3. Start server
# ============================================================

set -e

DB_PATH="${DB_PATH:-/app/db/data/medisync.db}"
DB_DIR=$(dirname "$DB_PATH")

echo "[Entrypoint] DB_PATH = $DB_PATH"

# Buat direktori jika belum ada
mkdir -p "$DB_DIR"

# Jika DB belum ada, jalankan seed untuk isi data awal
if [ ! -f "$DB_PATH" ]; then
  echo "[Entrypoint] Database belum ada, menjalankan seed..."
  node db/seed.js
  echo "[Entrypoint] Seed selesai!"
else
  echo "[Entrypoint] Database sudah ada, skip seed."
fi

echo "[Entrypoint] Menjalankan server..."
exec node server.js

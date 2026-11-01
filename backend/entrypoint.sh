#!/usr/bin/env bash
set -e

echo "[entrypoint] Menjalankan seeding awal database..."
python -m app.seed

echo "[entrypoint] Menjalankan server Uvicorn..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1 \
  --proxy-headers \
  --forwarded-allow-ips='*' \
  --timeout-graceful-shutdown 15

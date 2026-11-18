#!/bin/sh
# Jalankan dump PostgreSQL on-demand dari root project.
# Pemakaian: sh recovery/backup-now.sh
set -eu

docker compose exec backup /scripts/dump_logis.sh

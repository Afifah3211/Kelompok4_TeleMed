#!/bin/bash
# Izinkan container backup menjalankan pg_basebackup (koneksi replication).
# Sesuai catatan Lampiran A laporan: pg_hba.conf harus mengizinkan replication.
set -e
echo "host replication all all scram-sha-256" >> "$PGDATA/pg_hba.conf"

# Image PostgreSQL 16 + folder /wal_archive yang bisa ditulis user postgres.
# Tanpa ini, volume wal_archive dimiliki root dan archive_command gagal (permission denied).
FROM postgres:16
RUN mkdir -p /wal_archive && chown postgres:postgres /wal_archive && chmod 700 /wal_archive

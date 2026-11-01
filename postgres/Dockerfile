# PostgreSQL 16 + konfigurasi WAL Archive
FROM postgres:16

# Salin konfigurasi langsung ke image
COPY postgresql.conf /etc/postgresql/postgresql.conf

# Siapkan folder WAL Archive
RUN mkdir -p /wal_archive \
    && chown postgres:postgres /wal_archive \
    && chmod 700 /wal_archive
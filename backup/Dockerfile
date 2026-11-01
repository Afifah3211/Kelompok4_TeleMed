FROM postgres:16

# Install cron, openssl (AES-256), rsync, dan tzdata
RUN apt-get update && apt-get install -y --no-install-recommends \
    cron \
    openssl \
    rsync \
    tzdata \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Atur timezone Asia/Jakarta (WIB)
ENV TZ=Asia/Jakarta
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Buat direktori kerja untuk skrip, backups, dan offsite
RUN mkdir -p /scripts /backups/dump /backups/base /offsite /wal_archive

# Salin skrip backup dan buat executable
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

# Salin konfigurasi crontab
COPY crontab /etc/cron.d/backup_cron
RUN chmod 0644 /etc/cron.d/backup_cron

# Salin dan set entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Reset ENTRYPOINT postgres bawaan
ENTRYPOINT ["/entrypoint.sh"]

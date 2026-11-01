# ============================================================
# TeleMed - Backend Dockerfile (Python 3.12 FastAPI)
# Multi-stage build dengan postgresql-client-16 resmi PGDG
# ============================================================

# ── STAGE 1: Builder ──────────────────────────────────────────
FROM python:3.12-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── STAGE 2: Production Runtime ───────────────────────────────
FROM python:3.12-slim-bookworm AS production

LABEL maintainer="Kelompok4 TeleMed"
LABEL app="telemed-backend"
LABEL version="2.0.0"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# Install postgresql-client-16 resmi dari PGDG (kompatibel server PostgreSQL 16)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/*

# Buat user non-root telemed (prinsip least privilege)
RUN groupadd -r telemed && useradd -r -g telemed -d /app telemed

WORKDIR /app

# Salin venv dari stage builder
COPY --from=builder /opt/venv /opt/venv

# Siapkan direktori /backups dan direktori /app dengan ownership user telemed
RUN mkdir -p /backups /app \
    && chown -R telemed:telemed /backups /app

# Salin source code aplikasi
COPY --chown=telemed:telemed . /app

RUN chmod +x /app/entrypoint.sh

USER telemed

EXPOSE 8000

# Health check berbasis Python runtime (image slim tidak memiliki wget/curl)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/health',timeout=3)" || exit 1

CMD ["/app/entrypoint.sh"]

# ============================================================
# MediSync Telemedicine Platform - Backend Dockerfile
# Tugas Pertemuan 2: Containerization & DRP
#
# Teknologi: Node.js 22 LTS + better-sqlite3
# Arsitektur: Multi-stage build (builder → production)
#
# Stage 1 (builder): Install & compile native modules di Alpine
# Stage 2 (production): Image ramping hanya dengan runtime
# ============================================================

# ── STAGE 1: Builder — compile native modules ────────────────
# Pakai Node 22 karena better-sqlite3 v13+ mensyaratkan Node >=22
FROM node:22-alpine AS builder

# Install build tools untuk kompilasi better-sqlite3 dari source
# python3, make, g++ = toolchain C++ untuk node-gyp
# sqlite = header library SQLite
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copy package.json duluan → manfaatkan Docker layer cache
COPY package*.json ./

# Kompilasi dari source (npm_config_build_from_source=true)
# Menghindari prebuilt binary yang bisa crash di Alpine/WSL2
RUN npm_config_build_from_source=true npm ci --only=production

# Copy seluruh source code backend
COPY . .

# ── STAGE 2: Production — image ramping ──────────────────────
FROM node:22-alpine AS production

LABEL maintainer="Kelompok4 TeleMed"
LABEL app="medisync-backend"
LABEL version="1.0.0"

# Runtime: sqlite CLI (untuk debugging) + shared libs C++ (untuk better-sqlite3)
# libstdc++ dan libgcc diperlukan agar .node binary bisa diload
RUN apk add --no-cache sqlite libstdc++ libgcc

# Buat user non-root (prinsip least privilege)
RUN addgroup -S medisync && adduser -S medisync -G medisync

WORKDIR /app

# Copy node_modules yang sudah dikompilasi untuk Linux Alpine
COPY --from=builder /app/node_modules ./node_modules

# Copy source code dengan ownership user medisync
COPY --chown=medisync:medisync . .

# Buat direktori volume dan pastikan dimiliki user medisync
# /app/db/data → SQLite database (di-mount sebagai volume persisten)
# /app/backups → PITR snapshot DRP
# /app/recovery → Log recovery DRP
RUN mkdir -p /app/db/data /app/backups /app/recovery \
    && chown -R medisync:medisync /app/db/data /app/backups /app/recovery \
    && chmod +x /app/entrypoint.sh

EXPOSE 5000

# Health check: pastikan API merespons sebelum dependant service start
HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=5 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Jalankan sebagai non-root
USER medisync

# Entrypoint auto-seed + start server
CMD ["/app/entrypoint.sh"]

# ============================================================
# MediSync Telemedicine Platform - Backend Dockerfile
# Teknologi: Node.js 20 LTS + better-sqlite3
# Arsitektur: Multi-stage build untuk image lebih kecil
# Fungsi DRP: Container ini mengmount volume persisten
#             (/app/db/data) sebagai fondasi backup & recovery.
# ============================================================

# ── STAGE 1: Dependencies builder ───────────────────────────
FROM node:20-alpine AS builder

# Install build tools untuk native addon (better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copy package files & install (memanfaatkan Docker layer cache)
COPY package*.json ./
RUN npm ci --only=production

# ── STAGE 2: Production image ────────────────────────────────
FROM node:20-alpine AS production

# Metadata image
LABEL maintainer="Kelompok4 TeleMed"
LABEL app="medisync-backend"
LABEL version="1.0.0"
LABEL description="MediSync Backend - Telemedicine API dengan SQLite"

# Dependensi runtime SQLite
RUN apk add --no-cache sqlite

# Buat user non-root untuk keamanan
RUN addgroup -S medisync && adduser -S medisync -G medisync

WORKDIR /app

# Salin node_modules dari builder stage
COPY --from=builder /app/node_modules ./node_modules

# Salin source code backend
COPY --chown=medisync:medisync . .

# Buat direktori data persisten & backup (akan di-mount sebagai Docker Volume)
# /app/db/data  → SQLite database file (PERSISTEN)
# /app/backups  → Backup snapshots (PERSISTEN)
# /app/recovery → Recovery scripts & logs (PERSISTEN)
RUN mkdir -p /app/db/data /app/backups /app/recovery \
    && chown -R medisync:medisync /app/db/data /app/backups /app/recovery

# Expose port API
EXPOSE 5000

# Health check container
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Jalankan sebagai user non-root
USER medisync

# Entry point: start server
CMD ["node", "server.js"]

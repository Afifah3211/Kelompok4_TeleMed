# ============================================================
# MediSync Telemedicine Platform - Frontend Dockerfile
# Teknologi: React 19 + Vite → Nginx (production static server)
# Arsitektur: Multi-stage build
#   Stage 1 (builder): Build React app dengan Vite
#   Stage 2 (nginx):   Serve static assets via Nginx
# ============================================================

# ── STAGE 1: Build React Application ────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (layer caching)
COPY package*.json ./
RUN npm ci

# Salin semua source code frontend
COPY . .

# Build production bundle
RUN npm run build

# ── STAGE 2: Nginx Production Server ────────────────────────
FROM nginx:1.27-alpine AS production

# Metadata image
LABEL maintainer="Kelompok4 TeleMed"
LABEL app="medisync-frontend"
LABEL version="1.0.0"
LABEL description="MediSync Frontend - React SPA via Nginx"

# Hapus default config Nginx & salin custom config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/medisync.conf

# Salin build output dari stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port HTTP
EXPOSE 80

# Health check container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

# Nginx berjalan di foreground
CMD ["nginx", "-g", "daemon off;"]

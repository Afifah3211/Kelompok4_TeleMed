import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.db import close_db_pool, init_db_pool
from app.limiter import limiter
from app.routers import (
    audit_logs,
    auth,
    backup,
    chat,
    consultations,
    drp,
    files,
    health,
    medical_records,
    medicines,
    prescriptions,
    users,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("telemed.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Memulai aplikasi TeleMed FastAPI...")
    await init_db_pool()
    await chat.ensure_chat_schema()
    try:
        files.init_minio_bucket()
        logger.info(f"MinIO bucket '{settings.MINIO_BUCKET}' berhasil diinisialisasi.")
    except Exception as exc:
        logger.warning(f"Inisialisasi MinIO bucket dilewati: {exc}")
    yield
    logger.info("Menghentikan aplikasi TeleMed FastAPI...")
    await close_db_pool()


app = FastAPI(
    title="TeleMed API",
    description="Backend API Platform Telemedis Kelompok 4 (FastAPI + PostgreSQL 16)",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Integrasi SlowAPI Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Error handler terpusat: sembunyikan detail error 500 dari klien
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )
    logger.exception(f"Unhandled server error pada {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Terjadi kesalahan internal pada server"},
    )


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# Konfigurasi CORS spesifik (bukan "*")
origins = [origin.strip() for origin in settings.CORS_ORIGIN.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers dengan prefix /api
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(consultations.router, prefix="/api/consultations", tags=["consultations"])
app.include_router(medical_records.router, prefix="/api/medical-records", tags=["medical-records"])
app.include_router(audit_logs.router, prefix="/api/audit-logs", tags=["audit-logs"])
app.include_router(medicines.router, prefix="/api/medicines", tags=["medicines"])
app.include_router(prescriptions.router, prefix="/api/prescriptions", tags=["prescriptions"])
app.include_router(backup.router, prefix="/api/backup", tags=["backup"])
app.include_router(drp.router, prefix="/api/drp", tags=["drp"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])

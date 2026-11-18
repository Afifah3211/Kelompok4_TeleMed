import re
import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    PGHOST: str = "db"
    PGPORT: int = 5432
    PGUSER: str = "telemed_admin"
    PGPASSWORD: str = "medisync2026"
    PGDATABASE: str = "telemed"
    PG_POOL_MAX: int = 10

    JWT_SECRET: str
    JWT_EXPIRES: str = "8h"
    CORS_ORIGIN: str = "http://localhost:8080"
    SEED_PASSWORD: str = "medisync2026"
    APP_ENV: str = "production"

    # --- MinIO / File Storage (CDN lokal) ---
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET: str = "telemed-files"
    MINIO_USE_SSL: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v or len(v.strip()) < 32:
            raise ValueError("JWT_SECRET WAJIB diisi dan minimal 32 karakter")
        return v.strip()

    @property
    def jwt_expires_seconds(self) -> int:
        s = self.JWT_EXPIRES.strip().lower()
        m = re.match(r"^(\d+)([smhd])?$", s)
        if not m:
            return 8 * 3600
        val = int(m.group(1))
        unit = m.group(2)
        if unit == "s":
            return val
        elif unit == "m":
            return val * 60
        elif unit == "h":
            return val * 3600
        elif unit == "d":
            return val * 86400
        return val


settings = Settings()

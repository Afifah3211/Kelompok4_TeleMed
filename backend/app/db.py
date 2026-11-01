import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.config import settings

logger = logging.getLogger(__name__)

pool: Optional[AsyncConnectionPool] = None


def get_conninfo() -> str:
    return (
        f"host={settings.PGHOST} "
        f"port={settings.PGPORT} "
        f"dbname={settings.PGDATABASE} "
        f"user={settings.PGUSER} "
        f"password={settings.PGPASSWORD}"
    )


async def init_db_pool() -> None:
    global pool
    conninfo = get_conninfo()
    max_retries = 15
    retry_delay = 2.0

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"[DB] Mencoba koneksi ke PostgreSQL ({attempt}/{max_retries})...")
            test_pool = AsyncConnectionPool(
                conninfo=conninfo,
                min_size=1,
                max_size=settings.PG_POOL_MAX,
                kwargs={"row_factory": dict_row},
                open=False,
            )
            await test_pool.open()
            async with test_pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1;")
            pool = test_pool
            logger.info("[DB] Koneksi PostgreSQL dan pool berhasil diinisialisasi.")
            return
        except Exception as exc:
            logger.warning(f"[DB] Percobaan koneksi {attempt} gagal: {exc}")
            if attempt == max_retries:
                logger.error("[DB] Gagal menghubungkan pool ke PostgreSQL setelah batas maksimal percobaan.")
                raise exc
            await asyncio.sleep(retry_delay)


async def close_db_pool() -> None:
    global pool
    if pool:
        logger.info("[DB] Menutup database pool...")
        await pool.close()
        pool = None
        logger.info("[DB] Database pool telah ditutup.")


async def fetch_all(query: str, params: Any = None) -> list[dict[str, Any]]:
    if not pool:
        raise RuntimeError("Database pool belum siap")
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params or ())
            return await cur.fetchall()


async def fetch_one(query: str, params: Any = None) -> Optional[dict[str, Any]]:
    if not pool:
        raise RuntimeError("Database pool belum siap")
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params or ())
            return await cur.fetchone()


async def execute(query: str, params: Any = None) -> None:
    if not pool:
        raise RuntimeError("Database pool belum siap")
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params or ())


@asynccontextmanager
async def transaction():
    if not pool:
        raise RuntimeError("Database pool belum siap")
    async with pool.connection() as conn:
        async with conn.transaction():
            yield conn

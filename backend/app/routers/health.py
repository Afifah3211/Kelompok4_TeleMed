import socket
import time
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db import fetch_one

router = APIRouter()
START_TIME = time.time()


@router.get("/health")
async def health_check():
    """Health check endpoint: status sistem, konektivitas database, instance hostname, dan uptime."""
    uptime_sec = int(time.time() - START_TIME)
    instance_name = socket.gethostname()

    try:
        await fetch_one("SELECT 1;")
        return {
            "status": "online",
            "db": "up",
            "instance": instance_name,
            "uptime": uptime_sec,
        }
    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "db": "down",
                "instance": instance_name,
                "uptime": uptime_sec,
            },
        )

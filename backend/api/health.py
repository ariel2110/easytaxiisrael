from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.redis import get_redis

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check")
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict:
    checks: dict = {"status": "ok", "database": "ok", "redis": "ok"}

    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        checks["database"] = "unavailable"
        checks["status"] = "degraded"

    try:
        await redis.ping()
    except Exception:
        checks["redis"] = "unavailable"
        checks["status"] = "degraded"

    return checks

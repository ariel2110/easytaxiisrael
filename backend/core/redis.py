from redis.asyncio import Redis

from core.config import settings

redis_client: Redis = Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
)


async def get_redis() -> Redis:
    return redis_client

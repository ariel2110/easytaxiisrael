import json
import uuid

from redis.asyncio.client import PubSub

from core.redis import redis_client

# GEO index key — all live drivers stored here for proximity searches
_DRIVERS_GEO_KEY = "drivers:live"
# Per-driver TTL key: expires 5 minutes after last ping, cleans up stale GEO entries
_DRIVER_GEO_TTL_SECONDS = 300


def _ride_location_channel(ride_id: uuid.UUID) -> str:
    return f"ride:{ride_id}:location"


async def publish_location(ride_id: uuid.UUID, payload: dict) -> None:
    """Publish a location payload to the ride's Redis channel."""
    await redis_client.publish(_ride_location_channel(ride_id), json.dumps(payload))


async def update_driver_geo(driver_id: uuid.UUID, lat: float, lng: float) -> None:
    """
    Update driver's live position in the Redis GEO index.
    GEOADD takes (longitude, latitude) — note: lng before lat.
    A companion TTL key marks the driver as active; use it to filter
    stale members when querying GEOSEARCH.
    """
    pipe = redis_client.pipeline(transaction=False)
    pipe.geoadd(_DRIVERS_GEO_KEY, [lng, lat, str(driver_id)])
    pipe.set(f"driver:live:{driver_id}", 1, ex=_DRIVER_GEO_TTL_SECONDS)
    await pipe.execute()


async def subscribe_to_ride_location(ride_id: uuid.UUID) -> PubSub:
    """
    Create and return a dedicated PubSub object subscribed to a ride channel.
    The caller is responsible for unsubscribing and closing it.
    """
    pubsub: PubSub = redis_client.pubsub()
    await pubsub.subscribe(_ride_location_channel(ride_id))
    return pubsub

import json
import uuid

from redis.asyncio.client import PubSub

from core.redis import redis_client


def _ride_location_channel(ride_id: uuid.UUID) -> str:
    return f"ride:{ride_id}:location"


async def publish_location(ride_id: uuid.UUID, payload: dict) -> None:
    """Publish a location payload to the ride's Redis channel."""
    await redis_client.publish(_ride_location_channel(ride_id), json.dumps(payload))


async def subscribe_to_ride_location(ride_id: uuid.UUID) -> PubSub:
    """
    Create and return a dedicated PubSub object subscribed to a ride channel.
    The caller is responsible for unsubscribing and closing it.
    """
    pubsub: PubSub = redis_client.pubsub()
    await pubsub.subscribe(_ride_location_channel(ride_id))
    return pubsub

"""
Event Bus — Redis Pub/Sub wrapper.

Publish / subscribe interface for all platform modules.
All inter-module communication goes through here — never direct calls.

Usage:
    # Publish
    await event_bus.publish(RideEvent.ride_requested, {"ride_id": "..."})

    # Subscribe (long-running listener)
    async for event_name, payload in event_bus.listen(["ride_requested"]):
        await my_handler(payload)
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from core.redis import redis_client

log = logging.getLogger(__name__)

_CHANNEL_PREFIX = "rideos:"


class EventBus:
    """
    Thin wrapper over redis.asyncio pub/sub.
    - publish: fire-and-forget (no ack required)
    - listen:  async generator; yields (channel_name, payload_dict)
    """

    # ── Publish ───────────────────────────────────────────────────────────────

    async def publish(self, event: str, payload: dict[str, Any]) -> None:
        channel = _CHANNEL_PREFIX + event
        message = json.dumps(payload, default=str)
        try:
            await redis_client.publish(channel, message)
            log.debug("[event_bus] published %s → %s", event, message[:120])
        except Exception as exc:
            log.error("[event_bus] publish failed for %s: %s", event, exc)

    # ── Subscribe ─────────────────────────────────────────────────────────────

    async def listen(
        self,
        events: list[str],
    ) -> AsyncIterator[tuple[str, dict]]:
        """
        Async generator that yields (event_name, payload) for each
        matching message published on the bus.

        Runs indefinitely — wrap in a task and cancel to stop.
        """
        channels = [_CHANNEL_PREFIX + e for e in events]
        async with redis_client.pubsub() as pubsub:
            await pubsub.subscribe(*channels)
            log.info("[event_bus] subscribed to %s", channels)
            try:
                while True:
                    msg = await pubsub.get_message(
                        ignore_subscribe_messages=True,
                        timeout=1.0,
                    )
                    if msg is None:
                        await asyncio.sleep(0.01)
                        continue
                    channel: str = msg["channel"]
                    event_name = channel.removeprefix(_CHANNEL_PREFIX)
                    try:
                        payload = json.loads(msg["data"])
                    except (json.JSONDecodeError, TypeError):
                        payload = {"raw": msg.get("data")}
                    yield event_name, payload
            finally:
                await pubsub.unsubscribe(*channels)

    # ── Typed helpers (convenience) ───────────────────────────────────────────

    async def publish_ride_event(self, event: str, ride_id: str, extra: dict | None = None) -> None:
        await self.publish(event, {"ride_id": ride_id, **(extra or {})})

    async def publish_driver_event(self, event: str, driver_id: str, extra: dict | None = None) -> None:
        await self.publish(event, {"driver_id": driver_id, **(extra or {})})


# Singleton
event_bus = EventBus()

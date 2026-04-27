"""
GPS tracking — HTTP + WebSocket endpoints.

Architecture:
  Driver  ──POST /rides/{id}/location──▶ DB + Redis pub
  Driver  ──WS  /ws/rides/{id}/driver──▶ DB + Redis pub  (streaming)
  Passenger ──WS /ws/rides/{id}/passenger──▶ Redis sub   (live feed)

WebSocket auth: pass JWT access token as ?token= query parameter
(browsers cannot set Authorization headers on WS handshake).
"""

import asyncio
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, get_db
from core.dependencies import get_current_user, require_roles
from core.pubsub import publish_location, subscribe_to_ride_location
from core.security import decode_access_token
from models.location import DriverLocationEvent
from models.ride import Ride, RideStatus
from models.user import User, UserRole
from monitoring.metrics import ws_connections_active
from schemas.location import LocationEventRead, LocationPush

router = APIRouter(tags=["tracking"])

# Active statuses during which location updates are valid
_TRACKABLE_STATUSES = {RideStatus.accepted, RideStatus.in_progress}

# Per-ride WebSocket connection caps (prevents DoS from malicious clients)
_MAX_DRIVER_CONNECTIONS_PER_RIDE = 1   # only the assigned driver
_MAX_PASSENGER_CONNECTIONS_PER_RIDE = 5  # passenger + possible admin monitors
_ws_driver_counts: dict[uuid.UUID, int] = defaultdict(int)
_ws_passenger_counts: dict[uuid.UUID, int] = defaultdict(int)


# ---------------------------------------------------------------------------
# WebSocket auth helper (cannot use Depends on WS handshake)
# ---------------------------------------------------------------------------

async def _authenticate_ws(token: str) -> User | None:
    """Decode JWT and return the active User, or None on any failure."""
    try:
        payload = decode_access_token(token)
        if payload.get("type") != "access":
            return None
        user_id: str | None = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None

    async with AsyncSessionLocal() as db:
        user = await db.get(User, uuid.UUID(user_id))
        if user and user.is_active:
            return user
    return None


# ---------------------------------------------------------------------------
# Shared DB helpers
# ---------------------------------------------------------------------------

async def _persist_location(
    ride_id: uuid.UUID,
    driver_id: uuid.UUID,
    lat: float,
    lng: float,
) -> DriverLocationEvent:
    """Persist a location event and return the committed object."""
    async with AsyncSessionLocal() as db:
        event = DriverLocationEvent(
            ride_id=ride_id,
            driver_id=driver_id,
            lat=lat,
            lng=lng,
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return event


def _event_to_payload(event: DriverLocationEvent) -> dict:
    return {
        "id": str(event.id),
        "ride_id": str(event.ride_id),
        "driver_id": str(event.driver_id),
        "lat": event.lat,
        "lng": event.lng,
        "recorded_at": event.recorded_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/rides/{ride_id}/location",
    response_model=LocationEventRead,
    status_code=status.HTTP_201_CREATED,
    summary="Push driver GPS location (HTTP)",
)
async def push_location_http(
    ride_id: uuid.UUID,
    payload: LocationPush,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> LocationEventRead:
    ride = await db.get(Ride, ride_id)
    if ride is None or ride.status not in _TRACKABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ride is not in a trackable state",
        )
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ride")

    event = DriverLocationEvent(
        ride_id=ride_id,
        driver_id=current_user.id,
        lat=payload.lat,
        lng=payload.lng,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    await publish_location(ride_id, _event_to_payload(event))
    return event


@router.get(
    "/rides/{ride_id}/location/latest",
    response_model=LocationEventRead | None,
    summary="Get the most recent driver location for a ride",
)
async def get_latest_location(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LocationEventRead | None:
    result = await db.execute(
        select(DriverLocationEvent)
        .where(DriverLocationEvent.ride_id == ride_id)
        .order_by(DriverLocationEvent.recorded_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# WebSocket: driver streams location
# ---------------------------------------------------------------------------

@router.websocket("/ws/rides/{ride_id}/driver")
async def driver_location_ws(
    websocket: WebSocket,
    ride_id: uuid.UUID,
    token: str = Query(...),
) -> None:
    """
    Driver streams GPS pings via WebSocket.

    Send:    {"lat": <float>, "lng": <float>}
    Receive: {"status": "ok", "recorded_at": "<iso8601>"}
             {"error": "<message>"}   — on validation failure (connection kept open)
    """
    user = await _authenticate_ws(token)
    if user is None or user.role != UserRole.driver:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    async with AsyncSessionLocal() as db:
        ride = await db.get(Ride, ride_id)
        valid = ride is not None and ride.driver_id == user.id and ride.status in _TRACKABLE_STATUSES

    if not valid:
        await websocket.close(code=4003, reason="Ride not active or not assigned to you")
        return

    if _ws_driver_counts[ride_id] >= _MAX_DRIVER_CONNECTIONS_PER_RIDE:
        await websocket.close(code=4029, reason="Too many driver connections for this ride")
        return

    await websocket.accept()
    _ws_driver_counts[ride_id] += 1
    ws_connections_active.inc()
    try:
        while True:
            raw = await websocket.receive_json()
            try:
                loc = LocationPush.model_validate(raw)
            except ValidationError as exc:
                await websocket.send_json({"error": exc.errors(include_url=False)})
                continue

            event = await _persist_location(ride_id, user.id, loc.lat, loc.lng)
            await publish_location(ride_id, _event_to_payload(event))
            await websocket.send_json({"status": "ok", "recorded_at": event.recorded_at.isoformat()})

    except WebSocketDisconnect:
        pass
    finally:
        _ws_driver_counts[ride_id] = max(0, _ws_driver_counts[ride_id] - 1)
        ws_connections_active.dec()


# ---------------------------------------------------------------------------
# WebSocket: passenger receives live location
# ---------------------------------------------------------------------------

@router.websocket("/ws/rides/{ride_id}/passenger")
async def passenger_location_ws(
    websocket: WebSocket,
    ride_id: uuid.UUID,
    token: str = Query(...),
) -> None:
    """
    Passenger subscribes to live driver location updates via WebSocket.

    Receives: {"id": ..., "ride_id": ..., "driver_id": ...,
               "lat": ..., "lng": ..., "recorded_at": ...}
    """
    user = await _authenticate_ws(token)
    if user is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    async with AsyncSessionLocal() as db:
        ride = await db.get(Ride, ride_id)
        if ride is None:
            await websocket.close(code=4004, reason="Ride not found")
            return
        is_participant = (
            user.role == UserRole.admin
            or ride.passenger_id == user.id
            or ride.driver_id == user.id
        )

    if not is_participant:
        await websocket.close(code=4003, reason="Not a participant of this ride")
        return

    if _ws_passenger_counts[ride_id] >= _MAX_PASSENGER_CONNECTIONS_PER_RIDE:
        await websocket.close(code=4029, reason="Too many subscriber connections for this ride")
        return

    await websocket.accept()
    _ws_passenger_counts[ride_id] += 1
    ws_connections_active.inc()
    pubsub = await subscribe_to_ride_location(ride_id)

    async def _forward() -> None:
        """Forward Redis messages to the WebSocket until cancelled or error."""
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    await websocket.send_text(message["data"])
                except Exception:
                    break

    forward_task = asyncio.create_task(_forward())

    try:
        # Block until the client disconnects; ignore any messages sent by client
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        forward_task.cancel()
        _ws_passenger_counts[ride_id] = max(0, _ws_passenger_counts[ride_id] - 1)
        ws_connections_active.dec()
        await pubsub.unsubscribe()
        await pubsub.aclose()

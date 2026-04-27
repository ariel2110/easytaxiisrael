"""
Execution Layer — ride-related DB updates.

⚠️ NO AI HERE. NO DECISIONS HERE.
This layer only executes what the orchestrator+decision_engine have already approved.

Every public function:
  1. Validates the state transition is legal
  2. Updates the DB
  3. Publishes the resulting event on the bus
  4. Returns the updated Ride object
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.ride import Ride, RideStatus
from models.user import User
from security.audit import AuditAction, audit
from services.events import RideEvent, event_bus

log = logging.getLogger(__name__)

_UTC = timezone.utc

# Valid state transitions (from → set of allowed next states)
_ALLOWED_TRANSITIONS: dict[RideStatus, set[RideStatus]] = {
    RideStatus.pending:     {RideStatus.assigned, RideStatus.cancelled},
    RideStatus.assigned:    {RideStatus.accepted, RideStatus.cancelled},
    RideStatus.accepted:    {RideStatus.in_progress, RideStatus.cancelled},
    RideStatus.in_progress: {RideStatus.completed, RideStatus.cancelled},
    RideStatus.completed:   set(),
    RideStatus.cancelled:   set(),
}


async def _get_ride(db: AsyncSession, ride_id: uuid.UUID) -> Ride:
    ride = await db.get(Ride, ride_id)
    if ride is None:
        raise ValueError(f"Ride {ride_id} not found")
    return ride


def _assert_transition(ride: Ride, target: RideStatus) -> None:
    allowed = _ALLOWED_TRANSITIONS.get(ride.status, set())
    if target not in allowed:
        raise ValueError(
            f"Illegal transition {ride.status.value} → {target.value} for ride {ride.id}"
        )


# ── Public execution functions ────────────────────────────────────────────────

async def assign_driver(
    db: AsyncSession,
    ride_id: uuid.UUID,
    driver_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip: str = "",
    ua: str = "",
) -> Ride:
    """Assign a driver to a pending ride (result of dispatch decision)."""
    ride = await _get_ride(db, ride_id)
    _assert_transition(ride, RideStatus.assigned)

    ride.driver_id = driver_id
    ride.status = RideStatus.assigned
    ride.assigned_at = datetime.now(_UTC)  # type: ignore[attr-defined]

    await audit(
        db, AuditAction.ride_accepted,
        actor_id=actor_id,
        resource_type="ride",
        resource_id=str(ride_id),
        ip_address=ip,
        user_agent=ua,
        detail=f"driver_id={driver_id}",
    )
    await db.commit()
    await event_bus.publish_ride_event(
        RideEvent.driver_assigned,
        str(ride_id),
        {"driver_id": str(driver_id)},
    )
    return ride


async def mark_accepted(
    db: AsyncSession,
    ride_id: uuid.UUID,
    driver_id: uuid.UUID,
    ip: str = "",
    ua: str = "",
) -> Ride:
    ride = await _get_ride(db, ride_id)
    _assert_transition(ride, RideStatus.accepted)

    ride.status = RideStatus.accepted
    ride.accepted_at = datetime.now(_UTC)  # type: ignore[attr-defined]

    await audit(db, AuditAction.ride_accepted, actor_id=driver_id,
                resource_type="ride", resource_id=str(ride_id), ip_address=ip, user_agent=ua)
    await db.commit()
    await event_bus.publish_ride_event(RideEvent.ride_accepted, str(ride_id))
    return ride


async def mark_started(
    db: AsyncSession,
    ride_id: uuid.UUID,
    driver_id: uuid.UUID,
    ip: str = "",
    ua: str = "",
) -> Ride:
    ride = await _get_ride(db, ride_id)
    _assert_transition(ride, RideStatus.in_progress)

    ride.status = RideStatus.in_progress
    ride.started_at = datetime.now(_UTC)  # type: ignore[attr-defined]

    await audit(db, AuditAction.ride_started, actor_id=driver_id,
                resource_type="ride", resource_id=str(ride_id), ip_address=ip, user_agent=ua)
    await db.commit()
    await event_bus.publish_ride_event(RideEvent.ride_started, str(ride_id))
    return ride


async def mark_completed(
    db: AsyncSession,
    ride_id: uuid.UUID,
    driver_id: uuid.UUID,
    ip: str = "",
    ua: str = "",
) -> Ride:
    ride = await _get_ride(db, ride_id)
    _assert_transition(ride, RideStatus.completed)

    ride.status = RideStatus.completed
    ride.completed_at = datetime.now(_UTC)  # type: ignore[attr-defined]

    await audit(db, AuditAction.ride_ended, actor_id=driver_id,
                resource_type="ride", resource_id=str(ride_id), ip_address=ip, user_agent=ua)
    await db.commit()
    await event_bus.publish_ride_event(RideEvent.ride_completed, str(ride_id))
    return ride


async def mark_cancelled(
    db: AsyncSession,
    ride_id: uuid.UUID,
    actor_id: uuid.UUID,
    reason: str = "",
    ip: str = "",
    ua: str = "",
) -> Ride:
    ride = await _get_ride(db, ride_id)
    _assert_transition(ride, RideStatus.cancelled)

    ride.status = RideStatus.cancelled
    ride.cancelled_at = datetime.now(_UTC)  # type: ignore[attr-defined]
    ride.cancellation_reason = reason or "cancelled"

    await audit(db, AuditAction.ride_cancelled, actor_id=actor_id,
                resource_type="ride", resource_id=str(ride_id), ip_address=ip, user_agent=ua,
                detail=reason)
    await db.commit()
    await event_bus.publish_ride_event(RideEvent.ride_cancelled, str(ride_id), {"reason": reason})
    return ride


async def block_driver(
    db: AsyncSession,
    driver_id: uuid.UUID,
    reason: str,
    admin_id: uuid.UUID | None = None,
) -> None:
    """Deactivate a driver. Called only after Decision Engine approval."""
    driver = await db.get(User, driver_id)
    if driver is None:
        raise ValueError(f"Driver {driver_id} not found")

    driver.is_active = False  # type: ignore[attr-defined]
    await audit(
        db, AuditAction.admin_evaluate_driver,
        actor_id=admin_id,
        resource_type="user",
        resource_id=str(driver_id),
        ip_address="",
        user_agent="",
        detail=f"BLOCKED: {reason}",
    )
    await db.commit()
    await event_bus.publish_driver_event(
        "driver_blocked", str(driver_id), {"reason": reason}
    )

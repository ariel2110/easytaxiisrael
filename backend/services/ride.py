"""
Ride service — all state-transition logic lives here so routes stay thin.

State machine:
  pending → assigned  (auto: find_available_driver)
  assigned → accepted | cancelled  (driver action)
  accepted → in_progress  (driver action)
  in_progress → completed  (driver action)
  pending|assigned|accepted → cancelled  (passenger or driver action)
"""

import math
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.location import DriverLocationEvent
from models.legal import DriverLegalStatus, LegalComplianceStatus
from models.ride import Ride, RideStatus
from models.user import User, UserRole
from monitoring.metrics import rides_cancelled_total, rides_completed_total, rides_created_total
from schemas.ride import CancelRequest, RideRequest
from services import payment as payment_service
from services import whatsapp as wa_svc
from services.push import PushEvent, send_event

# Maximum distance (km) to consider a driver "nearby"
MAX_DRIVER_DISTANCE_KM = 15.0


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_ride_or_404(db: AsyncSession, ride_id: uuid.UUID) -> Ride:
    ride = await db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")
    return ride


async def _find_available_driver(
    db: AsyncSession,
    pickup_lat: float,
    pickup_lng: float,
) -> User | None:
    """
    Find the nearest available (idle) driver within MAX_DRIVER_DISTANCE_KM.

    Strategy:
      1. Query all idle drivers (not on an active ride).
      2. For each, get their most recent GPS event.
      3. Pick the closest one within the radius.
      4. Fall back to any idle driver if none has a recent location.
    """
    busy_subq = (
        select(Ride.driver_id)
        .where(
            Ride.status.in_([
                RideStatus.assigned,
                RideStatus.accepted,
                RideStatus.in_progress,
            ]),
            Ride.driver_id.is_not(None),
        )
        .scalar_subquery()
    )
    idle_drivers_result = await db.execute(
        select(User).where(
            User.role == UserRole.driver,
            User.is_active.is_(True),
            User.id.not_in(busy_subq),
        )
    )
    idle_drivers: list[User] = list(idle_drivers_result.scalars().all())

    if not idle_drivers:
        return None

    # ── Compliance gate: only drivers with valid license AND insurance ────────
    legal_result = await db.execute(
        select(DriverLegalStatus).where(
            DriverLegalStatus.driver_id.in_([d.id for d in idle_drivers]),
            DriverLegalStatus.license_valid.is_(True),
            DriverLegalStatus.insurance_valid.is_(True),
            DriverLegalStatus.status == LegalComplianceStatus.approved,
        )
    )
    compliant_ids = {r.driver_id for r in legal_result.scalars().all()}
    idle_drivers = [d for d in idle_drivers if d.id in compliant_ids]

    if not idle_drivers:
        return None

    # Get latest GPS event for each idle driver in one query
    from sqlalchemy import func as sqlfunc
    latest_subq = (
        select(
            DriverLocationEvent.driver_id,
            sqlfunc.max(DriverLocationEvent.recorded_at).label("latest"),
        )
        .where(DriverLocationEvent.driver_id.in_([d.id for d in idle_drivers]))
        .group_by(DriverLocationEvent.driver_id)
        .subquery()
    )
    loc_result = await db.execute(
        select(DriverLocationEvent).join(
            latest_subq,
            (DriverLocationEvent.driver_id == latest_subq.c.driver_id)
            & (DriverLocationEvent.recorded_at == latest_subq.c.latest),
        )
    )
    location_map: dict[uuid.UUID, DriverLocationEvent] = {
        e.driver_id: e for e in loc_result.scalars().all()
    }

    best_driver: User | None = None
    best_km = float("inf")

    for driver in idle_drivers:
        loc = location_map.get(driver.id)
        if loc is None:
            # Driver has no GPS event — keep as fallback
            if best_driver is None:
                best_driver = driver
            continue
        km = _haversine_km(pickup_lat, pickup_lng, loc.lat, loc.lng)
        if km < best_km and km <= MAX_DRIVER_DISTANCE_KM:
            best_km = km
            best_driver = driver

    return best_driver


# ---------------------------------------------------------------------------
# Passenger actions
# ---------------------------------------------------------------------------

async def request_ride(
    db: AsyncSession,
    passenger: User,
    payload: RideRequest,
) -> Ride:
    if passenger.role not in (UserRole.passenger, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only passengers can request rides",
        )

    # ── ToS gate: passenger must have accepted Terms of Service ──────────────
    if passenger.tos_accepted_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must accept the Terms of Service before requesting a ride",
        )

    ride = Ride(
        passenger_id=passenger.id,
        status=RideStatus.pending,
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        dropoff_lat=payload.dropoff_lat,
        dropoff_lng=payload.dropoff_lng,
        pickup_address=payload.pickup_address,
        dropoff_address=payload.dropoff_address,
    )
    db.add(ride)
    await db.flush()  # get ride.id before assignment

    driver = await _find_available_driver(db, payload.pickup_lat, payload.pickup_lng)
    if driver:
        ride.driver_id = driver.id
        ride.status = RideStatus.assigned
        ride.assigned_at = _now()

    await db.commit()
    await db.refresh(ride)
    rides_created_total.inc()

    # Notify driver that a ride was assigned
    if driver:
        await send_event(driver.device_token, PushEvent.ride_assigned)
        await wa_svc.notify_driver_new_ride(
            driver.phone, str(ride.id), ride.pickup_address or f"{payload.pickup_lat},{payload.pickup_lng}"
        )
        await wa_svc.notify_ride_assigned(passenger.phone, None, str(ride.id))

    return ride


async def cancel_ride_by_passenger(
    db: AsyncSession,
    passenger: User,
    ride_id: uuid.UUID,
    payload: CancelRequest,
) -> Ride:
    ride = await _get_ride_or_404(db, ride_id)

    if ride.passenger_id != passenger.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ride")

    if ride.status not in (RideStatus.pending, RideStatus.assigned, RideStatus.accepted):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a ride with status '{ride.status}'",
        )

    ride.status = RideStatus.cancelled
    ride.cancellation_reason = payload.reason
    ride.cancelled_at = _now()
    await db.commit()
    await db.refresh(ride)
    rides_cancelled_total.inc()
    # Notify driver if one was assigned
    if ride.driver_id:
        driver = await db.get(User, ride.driver_id)
        if driver:
            await send_event(driver.device_token, PushEvent.ride_cancelled)
            await wa_svc.notify_ride_cancelled(driver.phone, str(ride.id), by="passenger")
    await wa_svc.notify_ride_cancelled(passenger.phone, str(ride.id), by="passenger")
    return ride


# ---------------------------------------------------------------------------
# Driver actions
# ---------------------------------------------------------------------------

def _assert_driver_owns_ride(ride: Ride, driver: User) -> None:
    if ride.driver_id != driver.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This ride is not assigned to you",
        )


async def accept_ride(
    db: AsyncSession,
    driver: User,
    ride_id: uuid.UUID,
) -> Ride:
    ride = await _get_ride_or_404(db, ride_id)
    _assert_driver_owns_ride(ride, driver)

    if ride.status != RideStatus.assigned:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot accept a ride with status '{ride.status}'",
        )

    ride.status = RideStatus.accepted
    ride.accepted_at = _now()
    await db.commit()
    await db.refresh(ride)
    # Notify passenger
    passenger = await db.get(User, ride.passenger_id)
    if passenger:
        await send_event(passenger.device_token, PushEvent.ride_accepted)
    return ride


async def reject_ride(
    db: AsyncSession,
    driver: User,
    ride_id: uuid.UUID,
    payload: CancelRequest,
) -> Ride:
    ride = await _get_ride_or_404(db, ride_id)
    _assert_driver_owns_ride(ride, driver)

    if ride.status != RideStatus.assigned:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject a ride with status '{ride.status}'",
        )

    ride.status = RideStatus.cancelled
    ride.cancellation_reason = payload.reason
    ride.cancelled_at = _now()
    await db.commit()
    await db.refresh(ride)
    # Notify passenger
    passenger = await db.get(User, ride.passenger_id)
    if passenger:
        await send_event(passenger.device_token, PushEvent.ride_rejected)
    return ride


async def start_ride(
    db: AsyncSession,
    driver: User,
    ride_id: uuid.UUID,
) -> Ride:
    ride = await _get_ride_or_404(db, ride_id)
    _assert_driver_owns_ride(ride, driver)

    if ride.status != RideStatus.accepted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot start a ride with status '{ride.status}'",
        )

    ride.status = RideStatus.in_progress
    ride.started_at = _now()
    await db.commit()
    await db.refresh(ride)
    # Notify passenger
    passenger = await db.get(User, ride.passenger_id)
    if passenger:
        await send_event(passenger.device_token, PushEvent.ride_started)
        await wa_svc.notify_ride_started(passenger.phone, str(ride.id))
    return ride


async def end_ride(
    db: AsyncSession,
    driver: User,
    ride_id: uuid.UUID,
) -> Ride:
    ride = await _get_ride_or_404(db, ride_id)
    _assert_driver_owns_ride(ride, driver)

    if ride.status != RideStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot end a ride with status '{ride.status}'",
        )

    ride.status = RideStatus.completed
    ride.completed_at = _now()
    await db.commit()
    await db.refresh(ride)
    rides_completed_total.inc()

    # ── Payment guarantee: ALWAYS process before returning ─────────────────
    # If payment fails the ride stays completed (driver worked) but the error
    # is logged and surfaced to monitoring so ops can reconcile manually.
    try:
        await payment_service.process_payment(db, ride.id)
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).error(
            "[end_ride] payment failed for ride %s: %s", ride.id, exc
        )
        # Do NOT re-raise — ride is complete, payment reconciliation happens
        # via the audit log + monitoring alert.

    # Notify passenger
    passenger = await db.get(User, ride.passenger_id)
    if passenger:
        await send_event(passenger.device_token, PushEvent.ride_completed)
        fare = float(ride.fare_ils or 0)
        await wa_svc.notify_ride_completed(passenger.phone, fare, str(ride.id))
    return ride


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

async def get_ride(db: AsyncSession, ride_id: uuid.UUID) -> Ride:
    return await _get_ride_or_404(db, ride_id)


async def list_rides_for_user(db: AsyncSession, user: User) -> list[Ride]:
    """Return rides relevant to the caller (all for admin, own for others)."""
    if user.role == UserRole.admin:
        result = await db.execute(
            select(Ride).order_by(Ride.created_at.desc()).limit(100)
        )
    elif user.role == UserRole.driver:
        result = await db.execute(
            select(Ride)
            .where(Ride.driver_id == user.id)
            .order_by(Ride.created_at.desc())
        )
    else:
        result = await db.execute(
            select(Ride)
            .where(Ride.passenger_id == user.id)
            .order_by(Ride.created_at.desc())
        )
    return list(result.scalars().all())

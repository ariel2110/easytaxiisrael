"""
Anomaly detection.

Detects suspicious patterns across rides and location streams:

  1. Stale ride      — ride stuck in assigned/accepted for too long
  2. Location jump   — driver moved unrealistically fast between pings
  3. Long ride       — ride in_progress well beyond expected duration
  4. Price outlier   — fare is a statistical outlier vs recent rides

All detectors return AnomalyResult objects, never raise.
The caller decides what to do (flag, alert, auto-cancel, etc.).
"""

from __future__ import annotations

import enum
import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.location import DriverLocationEvent
from models.payment import RidePayment
from models.ride import Ride, RideStatus

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------

_STALE_ASSIGNED_MINUTES = 10    # ride assigned but not accepted within N min
_STALE_ACCEPTED_MINUTES = 15    # ride accepted but not started within N min
_LONG_RIDE_MINUTES = 120        # in_progress for more than N min
_MAX_SPEED_KMH = 200.0          # flag GPS jump exceeding this speed
_PRICE_Z_SCORE_THRESHOLD = 3.0  # flag fares beyond 3 σ from recent mean


class AnomalyType(str, enum.Enum):
    stale_ride = "stale_ride"
    location_jump = "location_jump"
    long_ride = "long_ride"
    price_outlier = "price_outlier"


@dataclass
class AnomalyResult:
    anomaly_type: AnomalyType
    ride_id: uuid.UUID | None
    detail: str
    severity: str                # "low" | "medium" | "high"
    metadata: dict = field(default_factory=dict)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Individual detectors
# ---------------------------------------------------------------------------

async def detect_stale_rides(db: AsyncSession) -> list[AnomalyResult]:
    """Flag rides that have been stuck in assigned or accepted too long."""
    now = _now()
    anomalies: list[AnomalyResult] = []

    checks = [
        (RideStatus.assigned, "assigned_at", _STALE_ASSIGNED_MINUTES, "medium"),
        (RideStatus.accepted, "accepted_at", _STALE_ACCEPTED_MINUTES, "high"),
    ]

    for ride_status, ts_col, threshold_min, severity in checks:
        cutoff = now - timedelta(minutes=threshold_min)
        result = await db.execute(
            select(Ride).where(
                Ride.status == ride_status,
                getattr(Ride, ts_col) < cutoff,
            )
        )
        for ride in result.scalars().all():
            ts = getattr(ride, ts_col)
            age = int((now - ts).total_seconds() / 60)
            anomalies.append(AnomalyResult(
                anomaly_type=AnomalyType.stale_ride,
                ride_id=ride.id,
                detail=f"Ride {ride_status} for {age} min (threshold {threshold_min} min)",
                severity=severity,
                metadata={"status": ride_status, "age_minutes": age},
            ))

    return anomalies


async def detect_location_jumps(
    db: AsyncSession,
    ride_id: uuid.UUID,
    last_n: int = 10,
) -> list[AnomalyResult]:
    """Detect GPS pings that imply an impossible travel speed."""
    result = await db.execute(
        select(DriverLocationEvent)
        .where(DriverLocationEvent.ride_id == ride_id)
        .order_by(DriverLocationEvent.recorded_at.desc())
        .limit(last_n)
    )
    events = list(reversed(result.scalars().all()))  # oldest first

    anomalies: list[AnomalyResult] = []
    for prev, curr in zip(events, events[1:]):
        dist_km = _haversine_km(prev.lat, prev.lng, curr.lat, curr.lng)
        elapsed_h = (curr.recorded_at - prev.recorded_at).total_seconds() / 3600
        if elapsed_h <= 0:
            continue
        speed_kmh = dist_km / elapsed_h
        if speed_kmh > _MAX_SPEED_KMH:
            anomalies.append(AnomalyResult(
                anomaly_type=AnomalyType.location_jump,
                ride_id=ride_id,
                detail=f"Speed {speed_kmh:.1f} km/h exceeds threshold {_MAX_SPEED_KMH} km/h",
                severity="high",
                metadata={
                    "from": {"lat": prev.lat, "lng": prev.lng},
                    "to": {"lat": curr.lat, "lng": curr.lng},
                    "speed_kmh": round(speed_kmh, 1),
                    "dist_km": round(dist_km, 3),
                },
            ))

    return anomalies


async def detect_long_rides(db: AsyncSession) -> list[AnomalyResult]:
    """Flag rides that have been in_progress beyond the expected maximum."""
    now = _now()
    cutoff = now - timedelta(minutes=_LONG_RIDE_MINUTES)
    result = await db.execute(
        select(Ride).where(
            Ride.status == RideStatus.in_progress,
            Ride.started_at < cutoff,
        )
    )
    anomalies: list[AnomalyResult] = []
    for ride in result.scalars().all():
        age = int((now - ride.started_at).total_seconds() / 60)
        anomalies.append(AnomalyResult(
            anomaly_type=AnomalyType.long_ride,
            ride_id=ride.id,
            detail=f"Ride in_progress for {age} min (threshold {_LONG_RIDE_MINUTES} min)",
            severity="medium",
            metadata={"age_minutes": age},
        ))

    return anomalies


async def detect_price_outliers(
    db: AsyncSession,
    sample_size: int = 200,
) -> list[AnomalyResult]:
    """Flag completed payments whose fare is > 3 σ above the recent mean."""
    result = await db.execute(
        select(RidePayment.id, RidePayment.ride_id, RidePayment.total_amount)
        .order_by(RidePayment.created_at.desc())
        .limit(sample_size)
    )
    rows = result.all()
    if len(rows) < 10:  # not enough data
        return []

    amounts = [float(r.total_amount) for r in rows]
    mean = sum(amounts) / len(amounts)
    variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
    std = math.sqrt(variance) or 1.0

    anomalies: list[AnomalyResult] = []
    for row in rows:
        z = (float(row.total_amount) - mean) / std
        if z > _PRICE_Z_SCORE_THRESHOLD:
            anomalies.append(AnomalyResult(
                anomaly_type=AnomalyType.price_outlier,
                ride_id=row.ride_id,
                detail=f"Fare {row.total_amount} is {z:.1f} σ above mean ({mean:.2f})",
                severity="low",
                metadata={"z_score": round(z, 2), "mean": round(mean, 2), "std": round(std, 2)},
            ))

    return anomalies


# ---------------------------------------------------------------------------
# Convenience aggregator
# ---------------------------------------------------------------------------

async def run_all_anomaly_checks(db: AsyncSession) -> list[AnomalyResult]:
    """Run all platform-wide anomaly detectors and return combined results."""
    results: list[AnomalyResult] = []
    results.extend(await detect_stale_rides(db))
    results.extend(await detect_long_rides(db))
    results.extend(await detect_price_outliers(db))
    return results

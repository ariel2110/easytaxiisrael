"""
Surge pricing.

Combines demand score with driver supply to produce a fare multiplier.
The multiplier is applied on top of the base fare in services/payment.py.

  supply_ratio = available_drivers / max(active_rides, 1)
  surge = demand_weight + supply_penalty

Multiplier is capped at SURGE_MAX to prevent exploitative pricing.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.ride import Ride, RideStatus
from models.user import User, UserRole
from services.ai.demand import DemandLevel, DemandResult

# ---------------------------------------------------------------------------
# Thresholds (tune per market)
# ---------------------------------------------------------------------------

SURGE_MAX: Decimal = Decimal("3.00")
SURGE_MIN: Decimal = Decimal("1.00")

# Demand-level base multipliers
_DEMAND_MULTIPLIER: dict[DemandLevel, Decimal] = {
    DemandLevel.low:       Decimal("1.00"),
    DemandLevel.medium:    Decimal("1.25"),
    DemandLevel.high:      Decimal("1.75"),
    DemandLevel.very_high: Decimal("2.50"),
}

# Extra penalty when supply is critically low (supply_ratio < threshold)
_SUPPLY_THRESHOLDS: list[tuple[float, Decimal]] = [
    (0.25, Decimal("0.50")),  # < 25% supply → +0.50
    (0.50, Decimal("0.25")),  # < 50% supply → +0.25
    (1.00, Decimal("0.00")),  # healthy supply → no penalty
]

_CENT = Decimal("0.01")


@dataclass
class SurgeResult:
    multiplier: Decimal
    demand_level: DemandLevel
    available_drivers: int
    active_rides: int
    supply_ratio: float
    is_surging: bool


async def _count_available_drivers(db: AsyncSession) -> int:
    busy_subq = (
        select(Ride.driver_id)
        .where(
            Ride.status.in_([RideStatus.assigned, RideStatus.accepted, RideStatus.in_progress]),
            Ride.driver_id.is_not(None),
        )
        .scalar_subquery()
    )
    result = await db.execute(
        select(func.count()).select_from(User).where(
            User.role == UserRole.driver,
            User.is_active.is_(True),
            User.id.not_in(busy_subq),
        )
    )
    return result.scalar_one()


async def calculate_surge(db: AsyncSession, demand: DemandResult) -> SurgeResult:
    available = await _count_available_drivers(db)
    active_rides = demand.active_rides

    supply_ratio = available / max(active_rides, 1)

    base = _DEMAND_MULTIPLIER[demand.level]
    penalty = Decimal("0.00")
    for threshold, extra in _SUPPLY_THRESHOLDS:
        if supply_ratio < threshold:
            penalty = extra
            break

    multiplier = (base + penalty).quantize(_CENT, rounding=ROUND_HALF_UP)
    multiplier = max(SURGE_MIN, min(multiplier, SURGE_MAX))

    return SurgeResult(
        multiplier=multiplier,
        demand_level=demand.level,
        available_drivers=available,
        active_rides=active_rides,
        supply_ratio=round(supply_ratio, 4),
        is_surging=multiplier > SURGE_MIN,
    )

"""
Demand prediction.

Uses a rule-based heuristic combining:
  - Time-of-day weight   (rush hours, late night, etc.)
  - Day-of-week weight   (weekday vs weekend)
  - Observed ride volume (recent pending/active rides from DB)

Returns a DemandResult with a normalised score [0.0, 1.0] and a
human-readable level.  Swap the weight tables for a trained model
(scikit-learn, etc.) when real data is available.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.ride import Ride, RideStatus

# ---------------------------------------------------------------------------
# Configuration tables (easy to tune without touching logic)
# ---------------------------------------------------------------------------

# Weight by hour-of-day (0–23).  Values are multipliers [0.0, 1.0].
_HOUR_WEIGHT: dict[int, float] = {
    0: 0.20, 1: 0.15, 2: 0.10, 3: 0.05, 4: 0.05, 5: 0.10,
    6: 0.30, 7: 0.65, 8: 0.90, 9: 0.75, 10: 0.55, 11: 0.60,
    12: 0.70, 13: 0.65, 14: 0.55, 15: 0.60, 16: 0.80, 17: 1.00,
    18: 0.95, 19: 0.85, 20: 0.75, 21: 0.70, 22: 0.50, 23: 0.35,
}

# Weight by weekday (0=Monday … 6=Sunday).
_DOW_WEIGHT: dict[int, float] = {
    0: 0.80, 1: 0.75, 2: 0.80, 3: 0.85, 4: 1.00,
    5: 0.95, 6: 0.70,
}

# How many recent active rides counts as "high demand" (normalisation cap).
_ACTIVITY_CAP = 50


class DemandLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    very_high = "very_high"


@dataclass
class DemandResult:
    score: float          # 0.0 – 1.0
    level: DemandLevel
    active_rides: int
    hour_weight: float
    dow_weight: float


def _level_from_score(score: float) -> DemandLevel:
    if score < 0.30:
        return DemandLevel.low
    if score < 0.55:
        return DemandLevel.medium
    if score < 0.80:
        return DemandLevel.high
    return DemandLevel.very_high


async def predict_demand(db: AsyncSession, at: datetime | None = None) -> DemandResult:
    """Predict current demand level."""
    now = at or datetime.now(timezone.utc)
    hour_w = _HOUR_WEIGHT[now.hour]
    dow_w = _DOW_WEIGHT[now.weekday()]

    active_statuses = [
        RideStatus.pending,
        RideStatus.assigned,
        RideStatus.accepted,
        RideStatus.in_progress,
    ]
    result = await db.execute(
        select(func.count()).where(Ride.status.in_(active_statuses))
    )
    active_rides: int = result.scalar_one()

    activity_score = min(active_rides / _ACTIVITY_CAP, 1.0)

    # Weighted blend: time heuristic (70%) + live activity (30%)
    score = round(0.70 * (hour_w * dow_w) + 0.30 * activity_score, 4)
    score = max(0.0, min(score, 1.0))

    return DemandResult(
        score=score,
        level=_level_from_score(score),
        active_rides=active_rides,
        hour_weight=hour_w,
        dow_weight=dow_w,
    )

"""
AI Router — single entry-point that orchestrates all AI sub-modules.

Consumers (API layer, background tasks) should import from here
rather than calling demand/surge/anomaly directly, keeping the
public surface minimal and easy to extend.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from services.ai.anomaly import AnomalyResult, detect_location_jumps, run_all_anomaly_checks
from services.ai.demand import DemandLevel, DemandResult, predict_demand
from services.ai.surge import SurgeResult, calculate_surge


@dataclass
class RideIntelligence:
    """Complete AI snapshot for a ride request or active ride."""
    demand: DemandResult
    surge: SurgeResult
    fare_multiplier: Decimal        # convenience alias for surge.multiplier
    recommendation: str             # human-readable advisory


@dataclass
class PlatformSnapshot:
    """Platform-wide AI state used by admin dashboards or alerting."""
    demand: DemandResult
    surge: SurgeResult
    anomalies: list[AnomalyResult]
    anomaly_count: int


def _build_recommendation(demand: DemandResult, surge: SurgeResult) -> str:
    if demand.level == DemandLevel.very_high and surge.available_drivers < 5:
        return "Critical supply shortage — consider driver incentives immediately."
    if surge.is_surging and surge.available_drivers < 10:
        return "High demand with limited supply — surge pricing active."
    if demand.level == DemandLevel.low:
        return "Low demand — standard pricing. Good time to attract new passengers."
    return "Demand and supply are balanced — standard operations."


async def get_ride_intelligence(db: AsyncSession) -> RideIntelligence:
    """
    Return AI insights relevant to a new ride request:
    current demand level, surge multiplier, and an advisory.
    """
    demand = await predict_demand(db)
    surge = await calculate_surge(db, demand)
    return RideIntelligence(
        demand=demand,
        surge=surge,
        fare_multiplier=surge.multiplier,
        recommendation=_build_recommendation(demand, surge),
    )


async def get_platform_snapshot(db: AsyncSession) -> PlatformSnapshot:
    """
    Full platform AI snapshot: demand, surge, and all anomaly checks.
    Intended for admin dashboards and monitoring pipelines.
    """
    demand = await predict_demand(db)
    surge = await calculate_surge(db, demand)
    anomalies = await run_all_anomaly_checks(db)
    return PlatformSnapshot(
        demand=demand,
        surge=surge,
        anomalies=anomalies,
        anomaly_count=len(anomalies),
    )


async def check_ride_location_anomalies(
    db: AsyncSession,
    ride_id: uuid.UUID,
) -> list[AnomalyResult]:
    """Check for GPS anomalies on a specific ride."""
    return await detect_location_jumps(db, ride_id)

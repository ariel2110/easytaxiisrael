"""
Ride Orchestrator — State Machine
Implements the full ride lifecycle:

  REQUESTED → MATCHING → DISPATCHED → ACCEPTED → IN_PROGRESS → COMPLETED
                      ↘ NO_DRIVER
                      (any state) → CANCELLED

Flow per event:
  ride_requested  → call DispatchAgent (AI) → Decision Engine selects driver
                  → ExecutionLayer.assign_driver → publish driver_assigned
  driver_assigned → push notification to driver
  ride_accepted   → ExecutionLayer.mark_accepted
  ride_started    → ExecutionLayer.mark_started
  ride_completed  → ExecutionLayer.mark_completed → trigger payment
  ride_cancelled  → ExecutionLayer.mark_cancelled

AI agents provide suggestions only.
Decision Engine makes all approve/reject decisions.
Execution Layer performs all DB writes.
"""
from __future__ import annotations

import logging
import uuid
from enum import Enum
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.ride import RideStatus
from models.user import User, UserRole
from services.agents.dispatch import DispatchAgent
from services.agents.compliance_agent import ComplianceAgent
from services.decision_engine import ride_engine, Decision
from services.events import RideEvent, event_bus
from services.execution import (
    assign_driver,
    mark_accepted,
    mark_started,
    mark_completed,
    mark_cancelled,
)
from services.push import PushEvent, send_event

log = logging.getLogger(__name__)


class RideFlowState(str, Enum):
    REQUESTED   = "REQUESTED"
    MATCHING    = "MATCHING"
    DISPATCHED  = "DISPATCHED"
    ACCEPTED    = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED   = "COMPLETED"
    CANCELLED   = "CANCELLED"
    NO_DRIVER   = "NO_DRIVER"


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _load_active_drivers(db: AsyncSession) -> list[dict]:
    """Load all active idle drivers for dispatch consideration."""
    from models.location import DriverLocationEvent
    from sqlalchemy import desc

    stmt = select(User).where(
        User.role == UserRole.driver,
        User.is_active == True,  # noqa: E712
    )
    result = await db.execute(stmt)
    drivers = result.scalars().all()

    output: list[dict] = []
    for d in drivers:
        # Get latest GPS event
        loc_stmt = (
            select(DriverLocationEvent)
            .where(DriverLocationEvent.driver_id == d.id)
            .order_by(desc(DriverLocationEvent.recorded_at))
            .limit(1)
        )
        loc_result = await db.execute(loc_stmt)
        loc = loc_result.scalar_one_or_none()

        output.append({
            "id": str(d.id),
            "lat": loc.lat if loc else None,
            "lng": loc.lng if loc else None,
            "device_token": d.device_token,
            "rating": 4.5,          # TODO: pull from ratings aggregate
            "acceptance_rate": 0.85, # TODO: pull from stats
            "hours_today": 0.0,      # TODO: pull from ride history
            "hours_week": 0.0,
        })
    return output


# ── Main orchestrator class ───────────────────────────────────────────────────

class RideOrchestrator:
    """
    Stateless orchestrator — state lives in the DB, not in memory.
    Safe to run in multiple replicas.
    """

    def __init__(self) -> None:
        self._dispatch_agent = DispatchAgent()
        self._compliance_agent = ComplianceAgent()

    async def handle_ride_requested(
        self,
        db: AsyncSession,
        ride_id: uuid.UUID,
        pickup_lat: float,
        pickup_lng: float,
        dropoff_lat: float,
        dropoff_lng: float,
        surge_multiplier: float = 1.0,
        actor_id: uuid.UUID | None = None,
        ip: str = "",
        ua: str = "",
    ) -> dict[str, Any]:
        """
        Full ride-request flow:
        1. Validate surge (Decision Engine)
        2. Load active drivers
        3. DispatchAgent → ranked candidates (AI suggestion)
        4. Decision Engine → selects final driver (hard rules)
        5. Execution Layer → assign_driver (DB write)
        6. Push notification to driver
        """
        # ── 1. Surge validation (Decision Engine) ────────────────────────────
        surge_decision: Decision = ride_engine.approve_surge(surge_multiplier)
        if not surge_decision.approved:
            # Cap surge instead of rejecting the ride
            surge_multiplier = ride_engine.MAX_SURGE
            log.warning("[orchestrator] surge capped to %.1f×", surge_multiplier)

        # ── 2. Load drivers ───────────────────────────────────────────────────
        drivers = await _load_active_drivers(db)
        if not drivers:
            await event_bus.publish_ride_event(
                RideEvent.driver_not_found, str(ride_id)
            )
            return {"state": RideFlowState.NO_DRIVER, "ride_id": str(ride_id)}

        # ── 3. AI dispatch suggestion ─────────────────────────────────────────
        ai_result = await self._dispatch_agent.run(
            {
                "pickup_lat": pickup_lat,
                "pickup_lng": pickup_lng,
                "dropoff_lat": dropoff_lat,
                "dropoff_lng": dropoff_lng,
                "available_drivers": drivers,
                "surge_multiplier": surge_multiplier,
            }
        )

        # Build ranked candidate list for Decision Engine
        if ai_result.success and ai_result.data.get("driver_id"):
            # Put AI top pick first, add distance data for rules
            top_id = ai_result.data["driver_id"]
            candidates = sorted(
                drivers,
                key=lambda d: (0 if d["id"] == top_id else 1, d.get("distance_km", 999))
            )
            # Copy score from AI result to top candidate
            for c in candidates:
                if c["id"] == top_id:
                    c["score"] = ai_result.data.get("score", 0.9)
                    break
        else:
            # AI failed — fallback: sort by distance
            candidates = sorted(drivers, key=lambda d: d.get("distance_km", 999))
            for i, c in enumerate(candidates):
                c["score"] = 1.0 / (i + 1)

        # ── 4. Decision Engine: final driver selection (rules only) ───────────
        decision: Decision = ride_engine.select_driver(candidates)
        if not decision.approved:
            await event_bus.publish_ride_event(
                RideEvent.driver_not_found, str(ride_id),
                {"reason": decision.reason}
            )
            return {
                "state": RideFlowState.NO_DRIVER,
                "ride_id": str(ride_id),
                "reason": decision.reason,
            }

        driver_id_str: str = decision.metadata["driver_id"]
        driver_id = uuid.UUID(driver_id_str)

        # ── 5. Execution Layer: DB write ──────────────────────────────────────
        ride = await assign_driver(
            db, ride_id, driver_id,
            actor_id=actor_id or driver_id,
            ip=ip, ua=ua,
        )

        # ── 6. Push notification to driver ────────────────────────────────────
        driver_token = next(
            (d.get("device_token") for d in drivers if d["id"] == driver_id_str),
            None,
        )
        if driver_token:
            await send_event(driver_token, PushEvent.ride_assigned)

        log.info(
            "[orchestrator] ride %s → driver %s (score=%.2f)",
            ride_id, driver_id, decision.metadata["score"],
        )
        return {
            "state": RideFlowState.DISPATCHED,
            "ride_id": str(ride_id),
            "driver_id": driver_id_str,
            "score": decision.metadata["score"],
            "surge_multiplier": surge_multiplier,
            "warnings": decision.warnings,
        }

    async def handle_driver_accepted(
        self,
        db: AsyncSession,
        ride_id: uuid.UUID,
        driver_id: uuid.UUID,
        passenger_token: str | None = None,
        ip: str = "",
        ua: str = "",
    ) -> dict:
        ride = await mark_accepted(db, ride_id, driver_id, ip=ip, ua=ua)
        if passenger_token:
            await send_event(passenger_token, PushEvent.ride_accepted)
        return {"state": RideFlowState.ACCEPTED, "ride_id": str(ride.id)}

    async def handle_ride_started(
        self,
        db: AsyncSession,
        ride_id: uuid.UUID,
        driver_id: uuid.UUID,
        passenger_token: str | None = None,
        ip: str = "",
        ua: str = "",
    ) -> dict:
        ride = await mark_started(db, ride_id, driver_id, ip=ip, ua=ua)
        if passenger_token:
            await send_event(passenger_token, PushEvent.ride_started)
        return {"state": RideFlowState.IN_PROGRESS, "ride_id": str(ride.id)}

    async def handle_ride_completed(
        self,
        db: AsyncSession,
        ride_id: uuid.UUID,
        driver_id: uuid.UUID,
        passenger_token: str | None = None,
        ip: str = "",
        ua: str = "",
    ) -> dict:
        ride = await mark_completed(db, ride_id, driver_id, ip=ip, ua=ua)
        if passenger_token:
            await send_event(passenger_token, PushEvent.ride_completed)

        # Publish for payment worker to pick up
        await event_bus.publish_ride_event(
            RideEvent.payment_processed, str(ride_id)
        )
        return {"state": RideFlowState.COMPLETED, "ride_id": str(ride.id)}

    async def handle_ride_cancelled(
        self,
        db: AsyncSession,
        ride_id: uuid.UUID,
        actor_id: uuid.UUID,
        reason: str = "",
        notify_token: str | None = None,
        ip: str = "",
        ua: str = "",
    ) -> dict:
        ride = await mark_cancelled(db, ride_id, actor_id, reason, ip=ip, ua=ua)
        if notify_token:
            await send_event(notify_token, PushEvent.ride_cancelled)
        return {"state": RideFlowState.CANCELLED, "ride_id": str(ride.id)}


# ── Singleton ─────────────────────────────────────────────────────────────────
_instance: RideOrchestrator | None = None


def get_ride_orchestrator() -> RideOrchestrator:
    global _instance
    if _instance is None:
        _instance = RideOrchestrator()
    return _instance

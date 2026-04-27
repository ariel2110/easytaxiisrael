"""
Agents Orchestrator — routes events to AI agents and passes
their suggestions to the Decision Engine.

⚠️ This orchestrator NEVER makes decisions directly.
   AI agents suggest → Decision Engine decides → Execution Layer acts.
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import Any

from services.decision_engine import driver_engine, ride_engine, support_engine
from .base import AgentResult
from .compliance_agent import ComplianceAgent
from .dispatch import DispatchAgent
from .onboarding import OnboardingAgent
from .support import SupportAgent

log = logging.getLogger(__name__)


class OrchestratorEvent(str, Enum):
    driver_onboard   = "driver_onboard"
    ride_request     = "ride_request"
    ride_completed   = "ride_completed"
    support_message  = "support_message"
    compliance_sweep = "compliance_sweep"


class Orchestrator:
    """
    Coordinates AI agents → Decision Engine.

    ⚠️ NO decisions here. NO DB writes here.
    Every handler returns:
      {
        "ai_suggestion": {...},   # raw agent output
        "decision":      {...},   # Decision Engine result (approved, reason)
        "next_action":   str      # instruction for the Execution Layer
      }
    """

    def __init__(self) -> None:
        self.onboarding = OnboardingAgent()
        self.compliance = ComplianceAgent()
        self.dispatch   = DispatchAgent()
        self.support    = SupportAgent()

    async def handle(self, event: OrchestratorEvent, payload: dict) -> dict[str, Any]:
        log.info("[agents_orchestrator] event=%s", event)
        handlers = {
            OrchestratorEvent.driver_onboard:   self._on_driver_onboard,
            OrchestratorEvent.ride_request:     self._on_ride_request,
            OrchestratorEvent.ride_completed:   self._on_ride_completed,
            OrchestratorEvent.support_message:  self._on_support_message,
            OrchestratorEvent.compliance_sweep: self._on_compliance_sweep,
        }
        handler = handlers.get(event)
        if not handler:
            return {"error": f"Unknown event: {event}"}
        return await handler(payload)

    # ── Event handlers ────────────────────────────────────────────────────────

    async def _on_driver_onboard(self, payload: dict) -> dict:
        """AI extracts document data → Decision Engine approves/rejects."""
        documents  = payload.get("documents", [])
        driver_data = payload.get("driver", {})

        # AI suggestion
        ai_result: dict = await self.onboarding.batch_verify_driver(documents)

        # Decision Engine (rules only)
        decision = driver_engine.approve_driver(ai_result, driver_data)

        return {
            "ai_suggestion": ai_result,
            "decision": decision.to_dict(),
            "next_action": "approve_driver" if decision.approved else "reject_driver",
        }

    async def _on_ride_request(self, payload: dict) -> dict:
        """AI ranks drivers → Decision Engine selects + validates surge."""
        dispatch_result: AgentResult = await self.dispatch.run(payload)

        drivers = payload.get("available_drivers", [])
        if dispatch_result.success and dispatch_result.data.get("driver_id"):
            top_id = dispatch_result.data["driver_id"]
            for d in drivers:
                if str(d.get("id")) == top_id:
                    d["score"] = dispatch_result.data.get("score", 0.9)
        else:
            for i, d in enumerate(drivers):
                d["score"] = 1.0 / (i + 1)

        driver_decision = ride_engine.select_driver(drivers) if drivers else None
        surge_decision  = ride_engine.approve_surge(payload.get("surge_multiplier", 1.0))

        return {
            "ai_suggestion": dispatch_result.data,
            "decision": {
                "driver": driver_decision.to_dict() if driver_decision else None,
                "surge":  surge_decision.to_dict(),
            },
            "next_action": "assign_driver" if (driver_decision and driver_decision.approved) else "no_driver",
        }

    async def _on_ride_completed(self, payload: dict) -> dict:
        """Check driver hours — rule-based, no AI needed."""
        ai_r: AgentResult = await self.compliance.run({
            "action": "check_hours",
            "hours_today": payload.get("driver_hours_today", 0),
            "hours_week":  payload.get("driver_hours_week", 0),
        })
        decision = driver_engine.block_driver({
            "hours_today": payload.get("driver_hours_today", 0),
            "hours_week":  payload.get("driver_hours_week", 0),
        })
        return {
            "ai_suggestion": ai_r.data,
            "decision": decision.to_dict(),
            "next_action": "block_driver" if not decision.approved else "none",
        }

    async def _on_support_message(self, payload: dict) -> dict:
        """AI responds → Decision Engine routes (auto-resolve or escalate)."""
        ai_r: AgentResult = await self.support.run(payload)
        decision = support_engine.route_message(ai_r.data, payload.get("message", ""))
        return {
            "ai_suggestion": ai_r.data,
            "decision": decision.to_dict(),
            "response": ai_r.data.get("response", ""),
            "next_action": decision.metadata.get("action", "escalate_human"),
        }

    async def _on_compliance_sweep(self, payload: dict) -> dict:
        """Batch compliance — AI analysis + rule enforcement per driver."""
        results = []
        for driver in payload.get("drivers", []):
            ai_r: AgentResult = await self.compliance.run(
                {"action": "evaluate_driver", "driver": driver}
            )
            decision = driver_engine.block_driver(driver)
            results.append({
                "driver_id": driver.get("id"),
                "ai_suggestion": ai_r.data,
                "decision": decision.to_dict(),
                "next_action": "block_driver" if not decision.approved else "none",
            })
        return {"evaluated": len(results), "results": results}


# ── Singleton ─────────────────────────────────────────────────────────────────

_instance: Orchestrator | None = None


def get_orchestrator() -> Orchestrator:
    global _instance
    if _instance is None:
        _instance = Orchestrator()
    return _instance


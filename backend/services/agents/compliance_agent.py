"""
Compliance & Legal Agent — Claude 3.5 Sonnet
Expert in Israeli transportation law (Amendment 142 / תיקון 142).
Evaluates rides, driver profiles, surge pricing, and working hours.
Falls back to deterministic rule-based checks when API key is absent.
"""
from __future__ import annotations

import logging

from .base import BaseAgent, AgentResult

log = logging.getLogger(__name__)

_SYSTEM = """You are a legal compliance expert specializing in Israeli transportation law.

Key regulations you enforce:
- תיקון 142 לפקודת התעבורה (Amendment 142, 2024): rideshare platform regulation
- נהג מורשה: valid Class B+ license + insurance with "הסעת נוסעים בשכר" clause
- שעות עבודה: max 12h/day, 60h/week for rideshare drivers
- פיצויים: platform must contribute to pension/severance for drivers >25h/week avg
- תעריפים: surge pricing capped at 2.5× base fare; tariffs must be published
- נגישות: ≥20% of active fleet must be accessible vehicles in metro areas
- ביטוח: minimum ₪7.5M third-party liability; must include paid-passenger-transport clause

Return ONLY valid JSON — no markdown, no explanation."""


class ComplianceAgent(BaseAgent):
    name = "compliance"

    async def run(self, payload: dict) -> AgentResult:
        """
        payload.action:
            "evaluate_ride"   — check a single ride for compliance
            "evaluate_driver" — check a driver profile
            "check_surge"     — validate surge multiplier
            "check_hours"     — validate working-hours limits
        """
        action = payload.get("action")
        dispatch = {
            "evaluate_ride": self._evaluate_ride,
            "evaluate_driver": self._evaluate_driver,
            "check_surge": self._check_surge,
            "check_hours": self._check_hours,
        }
        handler = dispatch.get(action)
        if not handler:
            return AgentResult(False, {"error": f"Unknown action: {action}"})
        return await handler(payload)

    # ── Ride evaluation ───────────────────────────────────────────────────────

    async def _evaluate_ride(self, payload: dict) -> AgentResult:
        ride = payload.get("ride", {})
        driver = payload.get("driver", {})
        fare = payload.get("fare", {})

        prompt = f"""Evaluate whether this ride complies with Israeli rideshare law.

Ride:
  distance_km: {ride.get('distance_km', 'unknown')}
  duration_min: {ride.get('duration_min', 'unknown')}
  time_of_day: {ride.get('time', 'unknown')}
Fare:
  total_amount: ₪{fare.get('total_amount', 'unknown')}
  surge_multiplier: {fare.get('surge_multiplier', 1.0)}×
Driver:
  hours_today: {driver.get('hours_today', 'unknown')}
  hours_week: {driver.get('hours_week', 'unknown')}
  license_valid: {driver.get('license_valid', 'unknown')}
  insurance_valid: {driver.get('insurance_valid', 'unknown')}

Return JSON:
{{
  "compliant": bool,
  "issues": [str],
  "warnings": [str],
  "surge_legal": bool,
  "driver_hours_ok": bool
}}"""

        raw = await self._call_anthropic(
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        if raw:
            data = self._parse_json(raw)
            if data:
                return AgentResult(True, data, raw=raw, model_used="claude-3-5-sonnet")

        # Rule-based fallback
        issues: list[str] = []
        surge = float(fare.get("surge_multiplier", 1.0))
        hours_today = float(driver.get("hours_today", 0))
        if surge > 2.5:
            issues.append(f"Surge {surge}× exceeds legal cap of 2.5×")
        if hours_today > 12:
            issues.append(f"Driver worked {hours_today}h today (max 12h)")
        if not driver.get("license_valid"):
            issues.append("Driver license invalid or expired")
        if not driver.get("insurance_valid"):
            issues.append("Driver insurance invalid or missing paid-transport clause")

        return AgentResult(
            not issues,
            {
                "compliant": not issues,
                "issues": issues,
                "warnings": [],
                "surge_legal": surge <= 2.5,
                "driver_hours_ok": hours_today <= 12,
            },
            model_used="fallback",
        )

    # ── Driver evaluation ─────────────────────────────────────────────────────

    async def _evaluate_driver(self, payload: dict) -> AgentResult:
        driver = payload.get("driver", {})

        prompt = f"""Evaluate whether this driver profile meets Israeli rideshare legal requirements.

Driver data: {driver}

Return JSON:
{{
  "can_operate": bool,
  "issues": [str],
  "requires_pension_contribution": bool,
  "recommended_actions": [str]
}}"""

        raw = await self._call_anthropic(
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        if raw:
            data = self._parse_json(raw)
            if data:
                return AgentResult(True, data, raw=raw, model_used="claude-3-5-sonnet")

        issues: list[str] = []
        if not driver.get("license_valid"):
            issues.append("Driving license not valid or expired")
        if not driver.get("insurance_valid"):
            issues.append("Insurance missing or lacks paid-transport coverage")
        requires_pension = float(driver.get("avg_weekly_hours", 0)) >= 25

        return AgentResult(
            not issues,
            {
                "can_operate": not issues,
                "issues": issues,
                "requires_pension_contribution": requires_pension,
                "recommended_actions": [],
            },
            model_used="fallback",
        )

    # ── Surge check ───────────────────────────────────────────────────────────

    async def _check_surge(self, payload: dict) -> AgentResult:
        multiplier = float(payload.get("multiplier", 1.0))
        legal = multiplier <= 2.5
        return AgentResult(
            legal,
            {"multiplier": multiplier, "legal": legal, "max_allowed": 2.5},
            model_used="rule",
        )

    # ── Hours check ───────────────────────────────────────────────────────────

    async def _check_hours(self, payload: dict) -> AgentResult:
        hours_today = float(payload.get("hours_today", 0))
        hours_week = float(payload.get("hours_week", 0))
        ok = hours_today <= 12 and hours_week <= 60
        return AgentResult(
            ok,
            {
                "ok": ok,
                "hours_today": hours_today,
                "hours_week": hours_week,
                "max_daily": 12,
                "max_weekly": 60,
            },
            model_used="rule",
        )

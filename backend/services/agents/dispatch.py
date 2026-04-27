"""
Matching & Dispatch Agent — Grok / Llama (via Groq)
Fast LLM for optimal driver selection.
Considers proximity, rating, acceptance rate, hours worked, and
dropoff zone return probability to maximise driver earnings.
Falls back to a weighted scoring function when API key is absent.
"""
from __future__ import annotations

import json
import logging
import math

from .base import BaseAgent, AgentResult

log = logging.getLogger(__name__)


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class DispatchAgent(BaseAgent):
    name = "dispatch"

    async def run(self, payload: dict) -> AgentResult:
        """
        payload:
            pickup_lat, pickup_lng, dropoff_lat, dropoff_lng: float
            available_drivers: list of {
                id, lat?, lng?, rating, completed_rides,
                hours_today, acceptance_rate, current_zone?
            }
            time_of_day: "HH:MM"
            demand_level: 0.0-1.0
        """
        drivers: list[dict] = payload.get("available_drivers", [])
        if not drivers:
            return AgentResult(False, {"driver_id": None, "reason": "No available drivers"})

        pickup_lat: float = payload["pickup_lat"]
        pickup_lng: float = payload["pickup_lng"]

        # Attach distance to each driver
        for d in drivers:
            if d.get("lat") is not None and d.get("lng") is not None:
                d["distance_km"] = round(
                    _haversine(pickup_lat, pickup_lng, d["lat"], d["lng"]), 2
                )
            else:
                d["distance_km"] = 999.0

        # Attempt LLM-based smart match (Groq is fast enough for real-time)
        data = await self._llm_match(payload, drivers)
        if data:
            return AgentResult(True, data, model_used="groq-llama3")

        # Weighted score fallback
        data = self._score_match(drivers)
        return AgentResult(True, data, model_used="score")

    async def _llm_match(self, payload: dict, drivers: list[dict]) -> dict | None:
        # Send only the 10 closest drivers to keep prompt small
        top = sorted(drivers, key=lambda d: d["distance_km"])[:10]

        prompt = f"""You are a rideshare dispatch optimizer for Israel.
Select the best driver for this ride.

Pickup:  ({payload['pickup_lat']:.5f}, {payload['pickup_lng']:.5f})
Dropoff: ({payload['dropoff_lat']:.5f}, {payload['dropoff_lng']:.5f})
Time: {payload.get('time_of_day', 'unknown')}
Demand level: {payload.get('demand_level', 0.5):.1f}/1.0

Available drivers:
{json.dumps(top, ensure_ascii=False)}

Scoring weights (most → least important):
  40% proximity to pickup
  25% driver rating (1-5 stars)
  20% acceptance rate (0-1)
  15% hours worked today (lower is better; max 12h legal limit)

Also consider: will the driver likely get a return ride from the dropoff zone?

Return JSON only:
{{"driver_id": "<id>", "score": 0.0-1.0, "reasoning": "<one sentence>"}}"""

        raw = await self._call_groq(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-70b-versatile",
            json_mode=True,
        )
        if not raw:
            return None

        data = self._parse_json(raw)
        driver_id = data.get("driver_id")
        if not driver_id:
            return None

        # Validate driver_id is from our list (LLM hallucination guard)
        valid_ids = {str(d["id"]) for d in top}
        if driver_id not in valid_ids:
            log.warning("[dispatch] LLM returned invalid driver_id %s — ignoring", driver_id)
            return None

        return data

    def _score_match(self, drivers: list[dict]) -> dict:
        """Deterministic weighted scoring — used when Groq unavailable."""
        best_score = -1.0
        best_driver: dict = drivers[0]

        for d in drivers:
            dist = d.get("distance_km", 999.0)
            rating = float(d.get("rating", 3.0))
            acceptance = float(d.get("acceptance_rate", 0.5))
            hours = float(d.get("hours_today", 0))

            dist_score = max(0.0, 1.0 - dist / 15.0)
            rating_score = (rating - 1.0) / 4.0
            hours_score = max(0.0, 1.0 - hours / 12.0)

            score = (
                dist_score * 0.40
                + rating_score * 0.25
                + acceptance * 0.20
                + hours_score * 0.15
            )
            if score > best_score:
                best_score = score
                best_driver = d

        return {
            "driver_id": str(best_driver["id"]),
            "score": round(best_score, 3),
            "reasoning": (
                f"Score-based: dist={best_driver['distance_km']:.1f}km, "
                f"rating={best_driver.get('rating', '?')}"
            ),
        }

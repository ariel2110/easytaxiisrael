"""
Customer Support Agent — GPT-4o mini / Gemini Flash
Handles passenger and driver inquiries in Hebrew and English.
Cheap, fast, and high-volume. Escalates to humans when needed.
"""
from __future__ import annotations

import logging

from .base import BaseAgent, AgentResult

log = logging.getLogger(__name__)

_SYSTEM = """You are a friendly customer support agent for EasyTaxi Israel (easytaxiisrael.com).
You serve both passengers (נוסעים) and drivers (נהגים).
Always respond in the same language the user writes in — Hebrew or English.
Be concise, empathetic, and solution-oriented.

Common scenarios:
- Driver not arriving / late → offer to find alternative or cancel for free
- Lost item in vehicle → provide "lost item" form link
- Fare dispute → check ride data and offer partial refund if warranted
- App technical issues → basic troubleshooting steps
- Driver: payment questions → explain weekly payout schedule
- Driver: document expiry → remind to renew via app
- Safety incident → escalate immediately as "urgent"

Return ONLY valid JSON:
{
  "response": "message to user (match their language)",
  "action_required": null | "refund" | "escalate_human" | "escalate_urgent" | "send_lost_item_form" | "credit_account",
  "action_data": {},
  "priority": "low" | "medium" | "high" | "urgent",
  "resolved": bool
}"""


class SupportAgent(BaseAgent):
    name = "support"

    async def run(self, payload: dict) -> AgentResult:
        """
        payload:
            message:    str       — user's message
            user_role:  str       — "passenger" | "driver"
            context:    dict      — optional {ride_id, ride_status, driver_name, ...}
            history:    list[dict]— optional prior messages [{role, content}]
        """
        message: str = payload.get("message", "")
        user_role: str = payload.get("user_role", "passenger")
        context: dict = payload.get("context", {})
        history: list[dict] = payload.get("history", [])

        ctx_parts: list[str] = []
        if context.get("ride_id"):
            ctx_parts.append(f"ride_id={context['ride_id']}")
        if context.get("ride_status"):
            ctx_parts.append(f"status={context['ride_status']}")
        if context.get("driver_name"):
            ctx_parts.append(f"driver={context['driver_name']}")
        ctx_str = f" [Context: {', '.join(ctx_parts)}]" if ctx_parts else ""

        user_content = f"[{user_role.upper()}]{ctx_str}: {message}"

        messages = [
            *history,
            {"role": "user", "content": user_content},
        ]

        raw = await self._call_openai(
            messages=[{"role": "system", "content": _SYSTEM}, *messages],
            model="gpt-4o-mini",
            json_mode=True,
        )
        if raw:
            data = self._parse_json(raw)
            if data:
                return AgentResult(True, data, raw=raw, model_used="gpt-4o-mini")

        # Fallback
        is_heb = any("\u05d0" <= c <= "\u05ea" for c in message)
        return AgentResult(
            False,
            {
                "response": (
                    "תודה על פנייתך. נציג שירות יחזור אליך בהקדם."
                    if is_heb
                    else "Thank you for contacting us. A support agent will follow up shortly."
                ),
                "action_required": "escalate_human",
                "action_data": {},
                "priority": "medium",
                "resolved": False,
            },
            model_used="fallback",
        )

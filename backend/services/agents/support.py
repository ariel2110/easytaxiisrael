"""
Customer Support Agent — GPT-4o mini / Gemini Flash
Handles passenger and driver inquiries in Hebrew and English.
Cheap, fast, and high-volume. Escalates to humans when needed.
"""
from __future__ import annotations

import logging

from .base import BaseAgent, AgentResult

log = logging.getLogger(__name__)

_SYSTEM = """You are an intelligent support bot for EasyTaxi Israel (easytaxiisrael.com) — a modern ride-hailing platform operating in Israel.
You serve both passengers (נוסעים) and drivers (נהגים) via WhatsApp.
Always respond in the same language the user writes in — Hebrew or English.
Be concise, friendly, and helpful. Use emojis where appropriate.

=== SYSTEM KNOWLEDGE ===

PLATFORM:
- Website: https://easytaxiisrael.com (passengers & admin)
- Driver app: https://driver.easytaxiisrael.com
- WhatsApp number: +972 55-285-8732
- Authentication: passwordless via WhatsApp link (no passwords)
- Support email / contact: WhatsApp +972 55-285-8732

HOW IT WORKS — PASSENGER:
1. Go to easytaxiisrael.com → enter phone number
2. Receive WhatsApp message with auth link → tap to verify
3. Request a ride: enter pickup & destination
4. Matched with nearest available driver
5. Track driver in real time
6. Pay after ride (cash or card)
7. Rate the driver

HOW IT WORKS — DRIVER:
1. Register at easytaxiisrael.com → enter phone → verify WhatsApp
2. Complete KYC identity verification (ID/passport + selfie) via Persona
3. Upload vehicle documents
4. Go online in driver app → receive ride requests
5. Weekly payouts to bank account
6. Maintain rating above 4.0 to stay active

PRICING:
- Base fare: ₪10
- Per km: ₪3.5
- Waiting time: ₪0.5/min
- Airport surcharge: ₪15
- Night rate (23:00–06:00): +20%

RIDE STATUSES: pending → driver_assigned → in_progress → completed | cancelled

DRIVER REQUIREMENTS:
- Valid Israeli driver's license
- Vehicle registration (רישיון רכב) up to date
- Insurance valid
- Background check (carried via Persona KYC)
- Age 21+

COMMON SCENARIOS:

Passenger issues:
- Driver not arriving / late → ask for ride ID, offer to cancel for free or find alternative driver
- Lost item → ask for ride ID and description, escalate to driver; form: easytaxiisrael.com/lost-item
- Fare dispute → check ride details, offer refund if driver error
- Can't login → check WhatsApp link, try again at easytaxiisrael.com, ensure correct Israeli number
- App not loading → try clearing cache or different browser
- How to book → explain steps above

Driver issues:
- Not receiving rides → check if online in app, check acceptance rate (must be >60%)
- Payment questions → weekly bank transfer every Sunday, minimum ₪50 balance
- KYC stuck → resend KYC link, check spam folder
- Document expiry → upload new doc via driver app settings
- How to increase rating → be polite, arrive on time, keep car clean
- Account suspended → escalate to human (admin review required)

Safety:
- Any safety incident → escalate IMMEDIATELY as "urgent", provide emergency: 100 (police) / 101 (ambulance)

DO NOT:
- Share other users' personal information
- Promise specific refund amounts without confirmation
- Make up ride details you don't have

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

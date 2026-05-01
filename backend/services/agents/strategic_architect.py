"""
Strategic Architect Agent — EasyTaxi Israel
Analyzes the entire platform and produces a daily Hebrew report with:
- Executive summary
- KPIs vs. benchmarks
- Bottlenecks (choke points)
- Top 5 prioritized action items
- Growth opportunities (monetization, market)
- Tech health assessment

Three-perspective analysis: Platform Owner | Driver | Passenger
Uses Claude Sonnet (primary) → GPT-4o (fallback) → rule-based (no key)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from .base import BaseAgent, AgentResult

log = logging.getLogger(__name__)

_SYSTEM = """You are the Strategic Architect of EasyTaxi Israel — a modern AI-powered ride-hailing platform operating in Israel.

Your role is to analyze the platform's current state and produce a comprehensive, actionable daily report in HEBREW.

Platform context:
- Tech: FastAPI backend, React frontends (passenger/driver/admin), PostgreSQL, Redis, Meta WhatsApp Cloud API
- Authentication: passwordless via WhatsApp link
- 8 AI agents: dispatch (Groq Llama), compliance (Claude), onboarding OCR (GPT-4o Vision), KYC primary/reviewer, support bot, orchestrator
- Pricing: base ₪10, ₪3.5/km, night +20%, platform fee 15%
- KYC: Persona hosted flow for drivers
- Amendment 142: rideshare regulation compliance

Analysis guidelines:
1. Think critically — if something is wrong, say it clearly
2. Three perspectives per issue: Platform (owner), Driver, Passenger
3. Scalability: how does this work at 10 vs 10,000 users?
4. Monetization: where can we capture more value?
5. Be specific — give numbers, percentages, timeframes

Return ONLY valid JSON in this exact structure:
{
  "executive_summary": "2-3 sentences in Hebrew summarizing the overall health",
  "overall_health_score": 0-100,
  "health_label": "מצויין|טוב|בינוני|חלש|קריטי",
  "kpis": [
    {
      "name": "שם המדד",
      "value": "ערך נוכחי",
      "benchmark": "יעד/ברנצ'מרק",
      "status": "good|warning|critical",
      "trend": "up|down|stable"
    }
  ],
  "bottlenecks": [
    {
      "area": "תחום",
      "description": "תיאור הבעיה",
      "impact_level": "high|medium|low",
      "affected_party": "platform|driver|passenger|all"
    }
  ],
  "top_actions": [
    {
      "priority": 1,
      "title": "כותרת הפעולה",
      "description": "תיאור מפורט",
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "timeframe": "מיידי|שבוע|חודש|רבעון"
    }
  ],
  "growth_opportunities": [
    {
      "title": "כותרת ההזדמנות",
      "description": "תיאור",
      "potential_revenue_ils_monthly": null,
      "complexity": "low|medium|high"
    }
  ],
  "tech_health": {
    "score": 0-100,
    "strong_points": ["נקודה חזקה 1", "נקודה חזקה 2"],
    "weak_points": ["נקודת חולשה 1", "נקודת חולשה 2"],
    "recommendations": ["המלצה טכנית 1", "המלצה טכנית 2"]
  },
  "generated_at": "ISO timestamp"
}"""


class StrategicArchitectAgent(BaseAgent):
    name = "strategic_architect"

    async def run(self, payload: dict) -> AgentResult:
        """
        payload:
            stats:         dict  — platform stats (users, rides, revenue etc.)
            agents_status: list  — list of {name, enabled, model}
            whatsapp:      dict  — WA provider info
            db_health:     str   — "ok" | "error"
            redis_health:  str   — "ok" | "error"
            recent_issues: list  — optional recent errors or anomalies
        """
        stats = payload.get("stats", {})
        agents_status = payload.get("agents_status", [])
        whatsapp = payload.get("whatsapp", {})
        db_health = payload.get("db_health", "unknown")
        redis_health = payload.get("redis_health", "unknown")

        # Build platform snapshot for the LLM
        total_users = stats.get("total_users", 0)
        total_drivers = stats.get("total_drivers", 0)
        active_drivers = stats.get("active_drivers", 0)
        total_passengers = stats.get("total_passengers", 0)
        total_rides = stats.get("total_rides", 0)
        completed_rides = stats.get("completed_rides", 0)
        cancelled_rides = stats.get("cancelled_rides", 0)
        pending_rides = stats.get("pending_rides", 0)
        total_revenue = stats.get("total_revenue", 0.0)
        total_payments = stats.get("total_payments", 0)

        completion_rate = round((completed_rides / total_rides * 100) if total_rides > 0 else 0, 1)
        cancellation_rate = round((cancelled_rides / total_rides * 100) if total_rides > 0 else 0, 1)
        driver_utilization = round((active_drivers / total_drivers * 100) if total_drivers > 0 else 0, 1)
        avg_fare = round((total_revenue / completed_rides) if completed_rides > 0 else 0, 2)

        agents_enabled = [a for a in agents_status if a.get("enabled")]
        agents_disabled = [a for a in agents_status if not a.get("enabled")]
        wa_provider = whatsapp.get("provider", "unknown")
        wa_state = whatsapp.get("state", "unknown")
        wa_phone = whatsapp.get("owner_phone", "unknown")
        wa_quality = whatsapp.get("quality_rating", "unknown")

        snapshot = f"""=== EasyTaxi Israel — Platform Snapshot ===
Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

INFRASTRUCTURE:
- Database: {db_health}
- Redis: {redis_health}
- WhatsApp: {wa_provider} | {wa_state} | {wa_phone} | Quality: {wa_quality}

USERS:
- Total users: {total_users}
- Drivers: {total_drivers} (active: {active_drivers}, utilization: {driver_utilization}%)
- Passengers: {total_passengers}
- Conversion (passenger/total users): {round(total_passengers/total_users*100, 1) if total_users > 0 else 0}%

RIDES:
- Total: {total_rides}
- Completed: {completed_rides} ({completion_rate}%)
- Cancelled: {cancelled_rides} ({cancellation_rate}%)
- Pending: {pending_rides}

REVENUE:
- Total platform revenue: ₪{total_revenue:.2f}
- Total payments: {total_payments}
- Average fare: ₪{avg_fare:.2f}

AI AGENTS ({len(agents_enabled)}/{len(agents_status)} enabled):
{chr(10).join(f"  ✅ {a['name']} ({a.get('model', 'unknown')})" for a in agents_enabled)}
{chr(10).join(f"  ❌ {a['name']} (DISABLED)" for a in agents_disabled) if agents_disabled else "  (all agents enabled)"}

TECH STACK:
- FastAPI + PostgreSQL + Redis + Meta WhatsApp Cloud API
- 8 AI agents (dispatch, compliance, OCR onboarding, KYC, support, orchestrator)
- Persona KYC + Israeli Amendment 142 compliance module
- 3 React frontends (passenger, driver, admin)
- Rate limiting + security headers + audit logging
"""

        messages = [{"role": "user", "content": snapshot}]

        # Try Claude first (strategic analysis quality)
        raw = await self._call_anthropic(
            system=_SYSTEM,
            messages=messages,
            model="claude-sonnet-4-5",
            max_tokens=4096,
        )

        # Fallback to GPT-4o
        if not raw:
            raw = await self._call_openai(
                messages=[{"role": "system", "content": _SYSTEM}, *messages],
                model="gpt-4o",
                json_mode=True,
            )

        if raw:
            data = self._parse_json(raw)
            if data:
                data["generated_at"] = datetime.now(timezone.utc).isoformat()
                return AgentResult(True, data, raw=raw, model_used="claude-sonnet-4-5")

        # Rule-based fallback (no LLM key configured)
        return self._rule_based_report(stats, agents_status, wa_state, db_health, redis_health)

    def _rule_based_report(
        self,
        stats: dict,
        agents_status: list,
        wa_state: str,
        db_health: str,
        redis_health: str,
    ) -> AgentResult:
        total_rides = stats.get("total_rides", 0)
        completed = stats.get("completed_rides", 0)
        total_drivers = stats.get("total_drivers", 0)
        active_drivers = stats.get("active_drivers", 0)
        total_users = stats.get("total_users", 0)
        total_passengers = stats.get("total_passengers", 0)
        revenue = stats.get("total_revenue", 0.0)

        completion_rate = round((completed / total_rides * 100) if total_rides > 0 else 0, 1)
        agents_ok = sum(1 for a in agents_status if a.get("enabled"))

        infra_ok = db_health == "ok" and redis_health == "ok" and wa_state in ("open", "CONNECTED")
        health_score = 60 + (10 if infra_ok else 0) + (10 if agents_ok >= 6 else 5) + (10 if total_drivers > 0 else 0) + (10 if completion_rate > 70 else 0)

        data = {
            "executive_summary": f"המערכת {'פעילה ויציבה' if infra_ok else 'עם בעיות תשתית'}. יש {total_users} משתמשים ({total_drivers} נהגים, {total_passengers} נוסעים), {total_rides} נסיעות סה\"כ עם {completion_rate}% השלמה. הכנסות: ₪{revenue:.0f}.",
            "overall_health_score": health_score,
            "health_label": "טוב" if health_score >= 70 else ("בינוני" if health_score >= 50 else "חלש"),
            "kpis": [
                {"name": "אחוז השלמת נסיעות", "value": f"{completion_rate}%", "benchmark": "85%+", "status": "good" if completion_rate >= 85 else ("warning" if completion_rate >= 60 else "critical"), "trend": "stable"},
                {"name": "נהגים פעילים", "value": str(active_drivers), "benchmark": f"{total_drivers} (100%)", "status": "good" if active_drivers == total_drivers else "warning", "trend": "stable"},
                {"name": "הכנסות פלטפורמה", "value": f"₪{revenue:.0f}", "benchmark": "₪50,000/חודש", "status": "warning" if revenue < 50000 else "good", "trend": "stable"},
                {"name": "סוכני AI פעילים", "value": f"{agents_ok}/{len(agents_status)}", "benchmark": f"{len(agents_status)}/{len(agents_status)}", "status": "good" if agents_ok == len(agents_status) else "warning", "trend": "stable"},
            ],
            "bottlenecks": [
                {"area": "נסיעות", "description": "אין נסיעות אקטיביות עדיין — צריך לגייס נוסעים", "impact_level": "high", "affected_party": "all"} if total_rides == 0 else
                {"area": "המרה", "description": f"יחס נוסעים/משתמשים: {round(total_passengers/total_users*100, 1) if total_users > 0 else 0}%", "impact_level": "medium", "affected_party": "platform"},
            ],
            "top_actions": [
                {"priority": 1, "title": "קמפיין גיוס נוסעים ראשון", "description": "שלח הודעות WhatsApp לכל 43 המשתמשים עם קוד הנחה 50% לנסיעה ראשונה", "effort": "low", "impact": "high", "timeframe": "מיידי"},
                {"priority": 2, "title": "אימות נהגים ראשונים", "description": f"וודא ש-{active_drivers} הנהגים הפעילים עברו KYC מלא ומוכנים לנסיעות", "effort": "low", "impact": "high", "timeframe": "שבוע"},
                {"priority": 3, "title": "הפעלת 6 תבניות WhatsApp", "description": "צור templates ב-Meta Business Manager לנסיעות (OTP, assigned, started, completed, cancelled, new_ride)", "effort": "low", "impact": "medium", "timeframe": "שבוע"},
                {"priority": 4, "title": "הגדרת Firebase FCM", "description": "הגדר push notifications לנהגים — חיוני לנסיעות בזמן אמת", "effort": "medium", "impact": "high", "timeframe": "שבוע"},
                {"priority": 5, "title": "מעקב KPIs שבועי", "description": "הגדר אלרטים: אם completion_rate < 80% שלח עדכון WhatsApp לאדמין", "effort": "low", "impact": "medium", "timeframe": "חודש"},
            ],
            "growth_opportunities": [
                {"title": "מנוי נהג פרימיום", "description": "₪200/חודש = מיצוב עדיפות בתור + כלי analytics מתקדמים", "potential_revenue_ils_monthly": 5400, "complexity": "low"},
                {"title": "נסיעות משותפות (rideshare)", "description": "מודול rideshare כבר קיים במערכת — צריך רק להפעיל בהתאם לתיקון 142", "potential_revenue_ils_monthly": None, "complexity": "medium"},
                {"title": "ביטוח נסיעה", "description": "שותפות עם חברת ביטוח — ₪2-5 per ride", "potential_revenue_ils_monthly": 3000, "complexity": "medium"},
                {"title": "API לעסקים", "description": "B2B API לחברות לנסיעות עסקיות — תמחור חודשי", "potential_revenue_ils_monthly": 10000, "complexity": "high"},
            ],
            "tech_health": {
                "score": 82,
                "strong_points": [
                    "ארכיטקטורת AI Agent → Decision Engine → Execution Layer מוצקה",
                    "WhatsApp Cloud API מחובר עם מספר אמיתי +972 55-285-8732",
                    "KYC מלא עם Persona + Amendment 142 compliance",
                    "Rate limiting + security headers + audit logging",
                    "~287 unit tests עוברים",
                ],
                "weak_points": [
                    "אין E2E tests",
                    "Firebase FCM לא מוגדר — push notifications לא פעיל",
                    "6 WhatsApp templates לא נוצרו ב-Meta",
                    "Groq API key לא מוגדר — DispatchAgent עם fallback בלבד",
                ],
                "recommendations": [
                    "הגדר FIREBASE_SERVICE_ACCOUNT_JSON ב-infra/.env",
                    "צור 6 WhatsApp message templates ב-Meta Business Manager",
                    "הוסף Playwright E2E tests לנתיבי משתמש קריטיים",
                    "הגדר Groq API key לשיפור ה-DispatchAgent",
                ],
            },
            "generated_at": "",
        }
        from datetime import datetime, timezone
        data["generated_at"] = datetime.now(timezone.utc).isoformat()
        return AgentResult(False, data, model_used="rule-based")

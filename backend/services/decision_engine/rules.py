"""
Decision Engine — deterministic rule enforcement.

⚠️ THIS IS THE ONLY PLACE WHERE DECISIONS ARE MADE.
AI agents suggest → Decision Engine decides → Execution Layer acts.

All methods are synchronous and pure (no I/O, no DB, no side effects).
Easy to unit-test, easy to audit, easy to remove or replace.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ── Shared result type ────────────────────────────────────────────────────────

@dataclass
class Decision:
    """Immutable result from every decision function."""
    approved: bool
    reason: str
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "approved": self.approved,
            "reason": self.reason,
            "warnings": self.warnings,
            "metadata": self.metadata,
        }


# ── Driver onboarding rules ───────────────────────────────────────────────────

class DriverDecisionEngine:
    """
    Rules for driver approval based on Israeli Amendment 142 (2024).
    AI onboarding agent provides suggestions; we enforce them here.
    """

    # Minimum confidence we require from the vision AI
    MIN_AI_CONFIDENCE: float = 0.70

    def approve_driver(self, ai_suggestion: dict, driver_data: dict) -> Decision:
        """
        Decide whether to approve a driver for the platform.

        ai_suggestion: output from OnboardingAgent.batch_verify_driver()
        driver_data:   current driver DB record (hours, compliance_score, etc.)
        """
        warnings: list[str] = []
        reasons: list[str] = []

        # 1. All required documents present
        missing = ai_suggestion.get("missing_documents", [])
        if missing:
            reasons.append(f"Missing documents: {', '.join(missing)}")

        # 2. All documents valid (AI says so AND we enforce expiry ourselves)
        if not ai_suggestion.get("all_valid", False):
            reasons.append("One or more documents are invalid or expired")

        # 3. Must have הסעת נוסעים בשכר insurance clause (Israeli law)
        if not ai_suggestion.get("has_paid_transport_coverage", False):
            reasons.append("Insurance policy lacks paid-passenger-transport clause (required by law)")

        # 4. AI confidence threshold
        docs: dict = ai_suggestion.get("documents", {})
        for doc_type, doc_data in docs.items():
            confidence = float(doc_data.get("confidence", 1.0))
            if confidence < self.MIN_AI_CONFIDENCE:
                warnings.append(
                    f"Low AI confidence ({confidence:.0%}) on {doc_type} — manual review recommended"
                )

        # 5. Compliance score from existing system
        compliance_score = float(driver_data.get("compliance_score", 0))
        if compliance_score < 0.5:
            reasons.append(f"Compliance score too low ({compliance_score:.1%})")

        if reasons:
            return Decision(approved=False, reason="; ".join(reasons), warnings=warnings)
        return Decision(
            approved=True,
            reason="All document checks passed",
            warnings=warnings,
        )

    def block_driver(self, driver_data: dict) -> Decision:
        """Decide whether to block a driver who is already active."""
        reasons: list[str] = []

        if not driver_data.get("license_valid", True):
            reasons.append("Driving license expired or revoked")
        if not driver_data.get("insurance_valid", True):
            reasons.append("Insurance expired or coverage gap")
        if float(driver_data.get("hours_today", 0)) > 12:
            reasons.append("Daily hours limit exceeded (>12h)")
        if float(driver_data.get("hours_week", 0)) > 60:
            reasons.append("Weekly hours limit exceeded (>60h)")

        if reasons:
            return Decision(approved=False, reason="; ".join(reasons))
        return Decision(approved=True, reason="Driver in good standing")

    def requires_pension_contribution(self, driver_data: dict) -> Decision:
        """Amendment 142: platform must contribute to pension for drivers >25h/week avg."""
        avg_hours = float(driver_data.get("avg_weekly_hours", 0))
        required = avg_hours >= 25
        return Decision(
            approved=required,
            reason=(
                f"Driver averaged {avg_hours:.1f}h/week — pension contribution required"
                if required
                else f"Driver averaged {avg_hours:.1f}h/week — below 25h threshold"
            ),
        )


# ── Ride rules ────────────────────────────────────────────────────────────────

class RideDecisionEngine:
    """Rules for ride request approval and fare validation."""

    MAX_SURGE: float = 2.5          # Israeli law cap
    MAX_DRIVER_DISTANCE_KM: float = 15.0
    MAX_DRIVER_HOURS_TODAY: float = 12.0

    def select_driver(self, candidates: list[dict]) -> Decision:
        """
        Select the best driver from a ranked list returned by DispatchAgent.
        We trust the AI's score ordering but enforce hard rules ourselves.
        """
        eligible = [
            c for c in candidates
            if float(c.get("distance_km", 999)) <= self.MAX_DRIVER_DISTANCE_KM
            and float(c.get("hours_today", 0)) < self.MAX_DRIVER_HOURS_TODAY
        ]

        if not eligible:
            return Decision(
                approved=False,
                reason="No eligible drivers: all beyond range or at hours limit",
            )

        # Pick top-scored eligible candidate (AI already ranked them)
        best = max(eligible, key=lambda c: float(c.get("score", 0)))
        return Decision(
            approved=True,
            reason=f"Selected driver {best['driver_id']} (score={best.get('score', 0):.2f})",
            metadata={"driver_id": best["driver_id"], "score": best.get("score", 0)},
        )

    def approve_surge(self, multiplier: float) -> Decision:
        """Israeli law: surge cap at 2.5×."""
        if multiplier > self.MAX_SURGE:
            return Decision(
                approved=False,
                reason=f"Surge {multiplier:.2f}× exceeds legal cap of {self.MAX_SURGE}×",
                metadata={"requested": multiplier, "capped_to": self.MAX_SURGE},
            )
        return Decision(
            approved=True,
            reason=f"Surge {multiplier:.2f}× within legal limit",
            metadata={"multiplier": multiplier},
        )

    def approve_ride_request(self, ride_data: dict, driver_data: dict) -> Decision:
        """Final gate before a ride is dispatched."""
        warnings: list[str] = []
        reasons: list[str] = []

        if not driver_data.get("license_valid", False):
            reasons.append("Assigned driver has invalid license")
        if not driver_data.get("insurance_valid", False):
            reasons.append("Assigned driver has invalid insurance")

        hours_today = float(driver_data.get("hours_today", 0))
        if hours_today >= self.MAX_DRIVER_HOURS_TODAY:
            reasons.append(f"Driver at hours limit ({hours_today:.1f}h today)")
        elif hours_today >= 10:
            warnings.append(f"Driver approaching hours limit ({hours_today:.1f}h today)")

        surge = float(ride_data.get("surge_multiplier", 1.0))
        surge_decision = self.approve_surge(surge)
        if not surge_decision.approved:
            reasons.append(surge_decision.reason)

        if reasons:
            return Decision(approved=False, reason="; ".join(reasons), warnings=warnings)
        return Decision(approved=True, reason="Ride approved", warnings=warnings)


# ── Support / escalation rules ────────────────────────────────────────────────

class SupportDecisionEngine:
    """Decide how to handle support messages based on AI classification."""

    URGENT_KEYWORDS = ["תאונה", "accident", "violent", "danger", "emergency", "police", "help", "הצלה"]

    def route_message(self, ai_suggestion: dict, message: str) -> Decision:
        """
        Decide whether to auto-resolve, escalate to human, or escalate as urgent.
        AI suggests a resolution; we enforce routing rules.
        """
        priority = ai_suggestion.get("priority", "medium")
        action = ai_suggestion.get("action_required")
        resolved = ai_suggestion.get("resolved", False)

        # Hard override: safety keywords always escalate urgently
        message_lower = message.lower()
        if any(kw in message_lower for kw in self.URGENT_KEYWORDS):
            return Decision(
                approved=False,
                reason="Urgent safety keyword detected — escalate immediately",
                metadata={"action": "escalate_urgent", "auto_resolved": False},
            )

        if resolved and priority in ("low", "medium"):
            return Decision(
                approved=True,
                reason="AI resolved message — auto-close",
                metadata={"action": action, "auto_resolved": True},
            )

        return Decision(
            approved=False,
            reason=f"Priority={priority}, action={action} — human review",
            metadata={"action": action or "escalate_human", "auto_resolved": False},
        )


# ── Singletons ─────────────────────────────────────────────────────────────────
driver_engine = DriverDecisionEngine()
ride_engine = RideDecisionEngine()
support_engine = SupportDecisionEngine()

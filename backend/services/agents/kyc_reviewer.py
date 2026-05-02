"""
KYC Reviewer Agent — Agent 2
Uses Claude Sonnet to cross-validate all document extractions from Agent 1
and apply Israeli transport law compliance rules.

Role: Legal compliance auditor — does NOT re-read images, works from Agent 1 data.

Israeli Law References:
  - פקודת התעבורה (Traffic Ordinance)
  - תקנות התעבורה, תשכ"א-1961
  - חוק הסעת נוסעים (Passenger Transport Law)
  - רישיון נהג מונית — משרד התחבורה
"""
from __future__ import annotations

import json
import logging
from datetime import date

from .base import BaseAgent, AgentResult

log = logging.getLogger(__name__)

# ── Israeli Law Requirements ────────────────────────────────────────────────

_RIDESHARE_REQUIRED = {
    "govt_id", "driving_license", "vehicle_registration",
    "vehicle_insurance", "police_clearance", "selfie",
}
_TAXI_REQUIRED = _RIDESHARE_REQUIRED | {
    "professional_license", "taxi_badge", "vehicle_inspection", "medical_clearance",
}

_SYSTEM = """You are a senior legal compliance officer specializing in Israeli transportation law.
You receive structured data extracted from driver documents by a primary AI agent.
Your job is to AUDIT this data for legal compliance according to Israeli law.

YOUR RESPONSIBILITIES:
1. Cross-validate consistency between documents (names match, plate numbers match, etc.)
2. Check Israeli-specific legal requirements
3. Calculate a compliance score (0-100)
4. Provide a final verdict with detailed reasoning

ISRAELI LAW RULES you must enforce:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOR ALL DRIVERS (rideshare + taxi):
  ✓ Government ID must be Israeli (IL) and not expired
  ✓ Driving license must be class B minimum and not expired
  ✓ Driver must be at least 21 years old
  ✓ Driving license must have been issued at least 2 years ago
  ✓ Vehicle insurance MUST explicitly cover "הסעת נוסעים בשכר" (paid passenger transport)
    → If covers_paid_transport=false: REJECT immediately — this is illegal in Israel
  ✓ Police clearance (אישור יושרה) must be less than 3 years old
  ✓ Vehicle registration must not be expired
  ✓ Selfie must show a clear face (liveness)
  ✓ Names across documents must match (allow small transliteration differences)
  ✓ Vehicle plate on registration must match insurance

FOR TAXI DRIVERS ONLY (driver_type = "licensed_taxi"):
  ✓ Must have professional license class D (רישיון נהג מקצועי)
  ✓ Must have valid taxi badge/license (רישיון מונית/טאבו)
  ✓ Vehicle must have passed periodic inspection (טסט תקופתי) — not expired
  ✓ Must have valid medical clearance from authorized doctor (אישור רופא מוסמך)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCORING GUIDE:
  90-100: All documents valid, no issues
  75-89:  Minor issues (expiry within 30 days, minor name mismatch)
  50-74:  Significant issues — requires admin review
  0-49:   Critical failure — reject

Return ONLY valid JSON in this exact format:
{
  "verdict": "approve" | "reject" | "manual_review",
  "compliance_score": <0-100>,
  "insurance_covers_rideshare": <true/false — CRITICAL CHECK>,
  "blocking_issues": [
    {"field": "vehicle_insurance", "issue": "does not cover paid passenger transport", "law": "חוק הסעת נוסעים"}
  ],
  "warnings": [
    {"field": "driving_license", "issue": "expires in 25 days"}
  ],
  "consistency_checks": {
    "names_match": <true/false>,
    "plates_match": <true/false>,
    "age_requirement": <true/false>,
    "experience_requirement": <true/false>
  },
  "extracted_summary": {
    "full_name": "<verified name>",
    "id_number": "<ID number>",
    "dob": "<YYYY-MM-DD>",
    "license_class": "<B/D/etc.>",
    "license_expiry": "<YYYY-MM-DD>",
    "vehicle_plate": "<plate>",
    "insurance_expiry": "<YYYY-MM-DD>"
  },
  "reasoning": "<2-3 sentences explaining the verdict in Hebrew>"
}
"""


class KYCReviewerAgent(BaseAgent):
    """Agent 2 — Claude Sonnet Israeli law compliance reviewer."""
    name = "kyc_reviewer"

    async def run(self, payload: dict) -> AgentResult:
        """
        payload:
          driver_type:      str   "rideshare" | "licensed_taxi"
          documents:        dict  {doc_type: agent1_result_dict, ...}
          application_id:   str  for logging
          sumsub_verified:  dict  optional — Sumsub identity to cross-validate against
        """
        driver_type = payload.get("driver_type", "rideshare")
        documents = payload.get("documents", {})
        app_id = payload.get("application_id", "?")
        sumsub_verified = payload.get("sumsub_verified")

        # Check required documents are present
        required = _TAXI_REQUIRED if driver_type == "licensed_taxi" else _RIDESHARE_REQUIRED
        missing = required - set(documents.keys())

        if missing:
            return AgentResult(
                False,
                {
                    "verdict": "reject",
                    "compliance_score": 0,
                    "blocking_issues": [
                        {"field": doc, "issue": "מסמך חסר / document not uploaded", "law": "Israeli transport law"}
                        for doc in missing
                    ],
                    "warnings": [],
                    "reasoning": f"חסרים מסמכים חיוניים: {', '.join(missing)}",
                },
                model_used="none",
            )

        prompt = self._build_prompt(driver_type, documents, sumsub_verified)
        raw = await self._call_anthropic(
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            model="claude-haiku-4-5",
            max_tokens=2048,
        )

        if not raw:
            log.warning("[kyc_reviewer] Claude unavailable for app=%s", app_id)
            return AgentResult(
                False,
                {"verdict": "manual_review", "compliance_score": 0,
                 "reasoning": "מערכת הבדיקה לא זמינה — נדרשת בדיקה ידנית"},
                model_used="claude-unavailable",
            )

        result = self._parse_json(raw)
        if not result:
            log.warning("[kyc_reviewer] JSON parse failed for app=%s, raw=%s", app_id, raw[:200])
            return AgentResult(False, {"verdict": "manual_review", "compliance_score": 0,
                                       "reasoning": "שגיאת עיבוד — נדרשת בדיקה ידנית"},
                               model_used="claude-haiku-4-5")

        verdict = result.get("verdict", "manual_review")
        score = result.get("compliance_score", 0)
        success = verdict == "approve" and score >= 75

        log.info("[kyc_reviewer] app=%s verdict=%s score=%s blocking=%d",
                 app_id, verdict, score, len(result.get("blocking_issues", [])))

        return AgentResult(success, result, raw=raw, model_used="claude-haiku-4-5")

    def _build_prompt(
        self,
        driver_type: str,
        documents: dict,
        sumsub_verified: dict | None = None,
    ) -> str:
        today = date.today().isoformat()
        docs_json = json.dumps(documents, ensure_ascii=False, indent=2)

        required_note = (
            "all documents including professional license, taxi badge, inspection, medical"
            if driver_type == "licensed_taxi"
            else "vehicle insurance (paid transport coverage required), police clearance, vehicle registration"
        )

        prompt = (
            f"Today's date: {today}\n"
            f"Driver type: {driver_type}\n"
            f"Required documents for this driver type: {required_note}\n\n"
            f"Documents extracted by Agent 1:\n{docs_json}\n\n"
        )

        # Add Sumsub cross-validation block when available
        if sumsub_verified and any(v for v in sumsub_verified.values() if v and v != "sumsub.com — verified driving_license + selfie"):
            sv_json = json.dumps(sumsub_verified, ensure_ascii=False, indent=2)
            prompt += (
                f"SUMSUB VERIFIED IDENTITY (already verified via driving_license + selfie):\n"
                f"{sv_json}\n\n"
                "CRITICAL CROSS-VALIDATION REQUIREMENTS:\n"
                "  1. Holder names on all documents MUST match the Sumsub verified_name\n"
                "  2. ID/document numbers on police_clearance MUST match Sumsub id_number\n"
                "  3. License class from documents must be consistent with Sumsub license_class\n"
                "  4. If a name mismatch is found — add a blocking_issue with field=\"identity_mismatch\"\n\n"
            )

        prompt += "Please review ALL documents for Israeli transport law compliance and return your verdict JSON."
        return prompt

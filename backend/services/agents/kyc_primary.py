"""
KYC Primary Agent — Agent 1
Uses GPT-4o Vision to read each document image and extract structured data.

Role: Document analyst — reads pixels, extracts text, validates dates.
Does NOT apply Israeli law — that's Agent 2's job.
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from .base import BaseAgent, AgentResult

log = logging.getLogger(__name__)

_SYSTEM = """You are an expert document verification analyst for Israeli government and transport documents.
Your job is to READ a document image and extract ALL relevant data fields accurately.

IMPORTANT RULES:
1. Extract exactly what you see — do NOT guess or infer
2. Dates must be in YYYY-MM-DD format
3. For Hebrew documents: read right-to-left carefully
4. If a field is not visible or not applicable: return null
5. Return ONLY valid JSON — no markdown, no explanation

For EVERY document return this base structure:
{
  "document_type": "<detected type>",
  "holder_name": "<full name in Hebrew or Latin>",
  "document_number": "<ID/license/policy number>",
  "issue_date": "<YYYY-MM-DD or null>",
  "expiry_date": "<YYYY-MM-DD or null>",
  "issuing_authority": "<who issued it>",
  "issuing_country": "<2-letter ISO, e.g. IL>",
  "is_expired": <true/false — based on today's date>,
  "is_readable": <true/false — can you clearly read the document?>,
  "confidence": <0-100 integer>,
  "issues": ["list", "of", "problems"],

  -- For driving_license add:
  "license_class": "<B/B+E/C/D etc.>",
  "license_restrictions": "<any restrictions or null>",
  "dob": "<date of birth YYYY-MM-DD>",
  "years_since_issue": <integer>,

  -- For vehicle_insurance add:
  "covers_paid_transport": <true/false — does policy include הסעת נוסעים בשכר?>,
  "vehicle_plate": "<plate number or null>",
  "coverage_type": "<מקיף/חובה/צד שלישי>",

  -- For vehicle_registration add:
  "vehicle_plate": "<plate number>",
  "vehicle_make": "<manufacturer>",
  "vehicle_model": "<model name>",
  "vehicle_year": <year integer>,
  "owner_name": "<registered owner>",

  -- For police_clearance add:
  "clearance_date": "<date issued YYYY-MM-DD>",
  "valid_for_years": <usually 3 in Israel>,

  -- For selfie add:
  "face_visible": <true/false>,
  "liveness_indicators": ["eyes_open", "neutral_expression", etc.],

  -- For taxi_badge add:
  "badge_number": "<badge/license number>",
  "valid_routes": "<city/region or null>",

  -- For medical_clearance add:
  "cleared_for_driving": <true/false>,
  "issuing_doctor": "<name or null>"
}
"""

_TODAY = datetime.utcnow().strftime("%Y-%m-%d")


class KYCPrimaryAgent(BaseAgent):
    """Agent 1 — GPT-4o Vision document reader."""
    name = "kyc_primary"

    async def run(self, payload: dict) -> AgentResult:
        """
        payload:
          image_b64:     str | None   base64-encoded JPEG/PNG
          image_url:     str | None   publicly accessible URL
          document_type: str          hint for document type
          application_id: str         for logging
        """
        doc_type = payload.get("document_type", "unknown")
        image_b64 = payload.get("image_b64")
        image_url = payload.get("image_url")
        app_id = payload.get("application_id", "?")

        if not (image_b64 or image_url):
            return AgentResult(False, {"error": "no_image"}, model_used="none")

        result = await self._analyse(doc_type, image_b64, image_url)
        if not result:
            return AgentResult(
                False,
                {"error": "llm_unavailable", "document_type": doc_type},
                model_used="none",
            )

        # Server-side expiry check (override LLM)
        expiry_str = result.get("expiry_date")
        if expiry_str:
            try:
                exp = date.fromisoformat(expiry_str)
                result["is_expired"] = exp < date.today()
                if result["is_expired"] and "document is expired" not in (result.get("issues") or []):
                    result.setdefault("issues", []).append("document is expired")
            except ValueError:
                result.setdefault("issues", []).append("expiry_date format invalid")

        success = (
            result.get("is_readable", False)
            and not result.get("is_expired", True)
            and result.get("confidence", 0) >= 60
        )
        log.info("[kyc_primary] app=%s doc=%s readable=%s expired=%s confidence=%s",
                 app_id, doc_type,
                 result.get("is_readable"), result.get("is_expired"),
                 result.get("confidence"))

        return AgentResult(success, result, model_used="gpt-4o")

    async def _analyse(
        self,
        doc_type: str,
        image_b64: str | None,
        image_url: str | None,
    ) -> dict | None:
        content: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    f"Today's date: {_TODAY}\n"
                    f"Document type hint: {doc_type}\n"
                    "Analyze this Israeli document image. Extract all data fields. "
                    "Pay special attention to Hebrew text. Return ONLY JSON."
                ),
            }
        ]

        if image_b64:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}", "detail": "high"},
            })
        elif image_url:
            content.append({
                "type": "image_url",
                "image_url": {"url": image_url, "detail": "high"},
            })

        raw = await self._call_openai(
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": content},
            ],
            model="gpt-4o",
            json_mode=False,  # Vision + JSON mode not always supported
        )
        if not raw:
            return None

        parsed = self._parse_json(raw)
        if not parsed:
            log.warning("[kyc_primary] Failed to parse JSON for doc_type=%s", doc_type)
        return parsed or None

"""
Onboarding Agent — GPT-4o Vision
Reads images of driving license, vehicle registration, and insurance documents.
Extracts structured data, validates expiry dates, and checks for
"הסעת נוסעים בשכר" (paid passenger transport) insurance coverage.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

from .base import BaseAgent, AgentResult

log = logging.getLogger(__name__)

_SYSTEM = """You are a document verification specialist for Israeli taxi/rideshare licensing.
Analyze the provided document image and extract structured data.

For ALL documents return:
- document_type: "driving_license" | "vehicle_registration" | "vehicle_insurance" | "unknown"
- holder_name: full name as it appears (or null)
- document_number: ID/license/policy number (or null)
- expiry_date: "YYYY-MM-DD" (or null if not applicable)
- is_valid: true only if document is not expired and appears legitimate
- issues: list of problems found (empty list if none)
- confidence: 0.0-1.0 reflecting how clearly the document was read

For vehicle_insurance additionally return:
- paid_transport_coverage: true if the policy explicitly includes "הסעת נוסעים בשכר"
  (paid passenger transport / ride-for-hire clause)
- plate_number: vehicle plate if visible

Return ONLY valid JSON, no markdown, no explanation."""


class OnboardingAgent(BaseAgent):
    name = "onboarding"

    async def run(self, payload: dict) -> AgentResult:
        """
        payload:
            image_b64:    str | None  — base64-encoded JPEG/PNG
            image_url:    str | None  — publicly accessible URL
            document_hint: str       — "driving_license" | "vehicle_registration" | "vehicle_insurance"
        """
        image_b64 = payload.get("image_b64")
        image_url = payload.get("image_url")
        hint = payload.get("document_hint", "unknown")

        if image_b64 or image_url:
            data = await self._verify_with_vision(image_b64, image_url, hint)
            if data:
                return AgentResult(True, data, model_used="gpt-4o-vision")

        # No API key configured or call failed → manual-review stub
        return AgentResult(False, self._stub(hint), model_used="fallback")

    async def _verify_with_vision(
        self,
        image_b64: str | None,
        image_url: str | None,
        hint: str,
    ) -> dict | None:
        content: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    f"Document type hint: {hint}. "
                    "Analyze this document image and return JSON as instructed."
                ),
            }
        ]
        if image_b64:
            content.append(
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
            )
        elif image_url:
            content.append({"type": "image_url", "image_url": {"url": image_url}})
        else:
            return None

        raw = await self._call_openai(
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": content},
            ],
            model="gpt-4o",
            json_mode=True,
        )
        if not raw:
            return None

        data = self._parse_json(raw)
        if not data:
            return None

        # Validate expiry server-side regardless of LLM output
        expiry_str = data.get("expiry_date")
        if expiry_str:
            try:
                if date.fromisoformat(expiry_str) < date.today():
                    data["is_valid"] = False
                    data.setdefault("issues", []).append("Document is expired")
            except ValueError:
                pass

        return data

    @staticmethod
    def _stub(hint: str) -> dict:
        return {
            "document_type": hint,
            "holder_name": None,
            "document_number": None,
            "expiry_date": None,
            "plate_number": None,
            "paid_transport_coverage": None,
            "is_valid": False,
            "issues": ["Vision API not configured — manual review required"],
            "confidence": 0.0,
        }

    async def batch_verify_driver(
        self,
        documents: list[dict],
    ) -> dict:
        """
        Verify all required documents for a driver onboarding.
        documents: list of {"type": str, "image_b64"?: str, "image_url"?: str}
        Returns aggregated approval status.
        """
        required = {"driving_license", "vehicle_registration", "vehicle_insurance"}
        results: dict[str, dict] = {}

        for doc in documents:
            doc_type = doc.get("type", "unknown")
            result = await self.run(
                {
                    "image_b64": doc.get("image_b64"),
                    "image_url": doc.get("image_url"),
                    "document_hint": doc_type,
                }
            )
            results[doc_type] = result.data

        missing = list(required - set(results.keys()))
        all_valid = all(r.get("is_valid", False) for r in results.values())
        has_paid_transport = results.get("vehicle_insurance", {}).get(
            "paid_transport_coverage", False
        )

        return {
            "documents": results,
            "missing_documents": missing,
            "all_valid": all_valid and not missing,
            "has_paid_transport_coverage": bool(has_paid_transport),
            "ready_for_approval": all_valid and not missing and bool(has_paid_transport),
        }

"""
Tests for Persona KYC integration.

Covers:
  - Webhook signature verification (unit)
  - Webhook event handling (unit)
  - POST /persona/inquiry (API — driver starts KYC)
  - GET  /persona/inquiry/status (API — driver checks status)
  - POST /persona/webhook (API — Persona callback)
  - GET  /admin/persona/drivers/{id}/inquiries (API — admin view)
  - Role enforcement (passenger / unauthenticated cannot call driver routes)
"""

import hashlib
import hmac
import json
import time
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import respx
import httpx

from services.persona import verify_webhook_signature
from models.persona import PersonaInquiry, PersonaInquiryStatus
from models.compliance import ComplianceStatus, DriverComplianceProfile


# ── Helpers ──────────────────────────────────────────────────────────────────

FAKE_SECRET = "wbhsec_test_persona_webhook_secret"
FAKE_API_KEY = "persona_sandbox_test_key"
FAKE_TEMPLATE_ID = "tmpl_test_123"
FAKE_INQUIRY_ID = "inq_abc123456789"
FAKE_SESSION_TOKEN = "sess_test_token_xyz"


def _make_signature(raw_body: bytes, secret: str, timestamp: int | None = None) -> str:
    ts = timestamp or int(time.time())
    signed = f"{ts}.{raw_body.decode('utf-8')}"
    sig = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


def _persona_webhook_payload(
    event_name: str = "inquiry.approved",
    inquiry_id: str = FAKE_INQUIRY_ID,
) -> dict:
    return {
        "data": {
            "attributes": {
                "name": event_name,
                "payload": {
                    "data": {
                        "type": "inquiry",
                        "id": inquiry_id,
                    }
                },
            }
        }
    }


# ── Unit: webhook signature verification ─────────────────────────────────────

class TestVerifyWebhookSignature:
    def test_valid_signature_returns_true(self):
        body = b'{"data": "test"}'
        sig = _make_signature(body, FAKE_SECRET)
        assert verify_webhook_signature(body, sig, FAKE_SECRET) is True

    def test_wrong_secret_returns_false(self):
        body = b'{"data": "test"}'
        sig = _make_signature(body, FAKE_SECRET)
        assert verify_webhook_signature(body, sig, "wrong_secret") is False

    def test_tampered_body_returns_false(self):
        body = b'{"data": "test"}'
        sig = _make_signature(body, FAKE_SECRET)
        assert verify_webhook_signature(b'{"data": "tampered"}', sig, FAKE_SECRET) is False

    def test_empty_header_returns_false(self):
        assert verify_webhook_signature(b"body", "", FAKE_SECRET) is False

    def test_malformed_header_returns_false(self):
        assert verify_webhook_signature(b"body", "not_a_signature", FAKE_SECRET) is False

    def test_multiple_pairs_key_rotation(self):
        """During key rotation Persona sends multiple space-separated pairs."""
        body = b'{"event": "test"}'
        sig1 = _make_signature(body, "old_secret")
        sig2 = _make_signature(body, FAKE_SECRET)
        combined = f"{sig1} {sig2}"
        assert verify_webhook_signature(body, combined, FAKE_SECRET) is True


# ── API: POST /persona/inquiry ────────────────────────────────────────────────

class TestStartInquiry:
    async def test_driver_can_start_kyc(self, client, driver_headers):
        persona_response = {
            "data": {
                "id": FAKE_INQUIRY_ID,
                "attributes": {
                    "status": "created",
                    "session-token": FAKE_SESSION_TOKEN,
                },
            }
        }
        with (
            patch("core.config.settings.PERSONA_API_KEY", FAKE_API_KEY),
            patch("core.config.settings.PERSONA_TEMPLATE_ID", FAKE_TEMPLATE_ID),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://withpersona.com/api/v1/inquiries").mock(
                return_value=httpx.Response(201, json=persona_response)
            )
            resp = await client.post(
                "/persona/inquiry", headers=driver_headers
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["persona_inquiry_id"] == FAKE_INQUIRY_ID
        assert data["status"] == "created"
        assert FAKE_INQUIRY_ID in data["hosted_flow_url"]
        assert FAKE_SESSION_TOKEN in data["hosted_flow_url"]

    async def test_passenger_cannot_start_kyc(self, client, passenger_headers):
        resp = await client.post("/persona/inquiry", headers=passenger_headers)
        assert resp.status_code == 403

    async def test_unauthenticated_cannot_start_kyc(self, client):
        resp = await client.post("/persona/inquiry")
        assert resp.status_code == 401

    async def test_returns_503_when_persona_not_configured(
        self, client, driver_headers
    ):
        with patch("core.config.settings.PERSONA_API_KEY", ""):
            resp = await client.post("/persona/inquiry", headers=driver_headers)
        assert resp.status_code == 503

    async def test_returns_502_on_persona_api_error(self, client, driver_headers):
        with (
            patch("core.config.settings.PERSONA_API_KEY", FAKE_API_KEY),
            patch("core.config.settings.PERSONA_TEMPLATE_ID", FAKE_TEMPLATE_ID),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://withpersona.com/api/v1/inquiries").mock(
                return_value=httpx.Response(500, json={"error": "server error"})
            )
            resp = await client.post("/persona/inquiry", headers=driver_headers)
        assert resp.status_code == 502


# ── API: GET /persona/inquiry/status ─────────────────────────────────────────

class TestInquiryStatus:
    async def test_returns_none_when_no_inquiry_exists(self, client, driver_headers):
        resp = await client.get("/persona/inquiry/status", headers=driver_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["persona_inquiry_id"] is None
        assert data["status"] is None

    async def test_returns_status_after_inquiry_created(
        self, client, driver_headers, driver, db
    ):
        # Seed a PersonaInquiry directly in the DB
        inquiry = PersonaInquiry(
            driver_id=driver.id,
            persona_inquiry_id="inq_status_test_001",
            status=PersonaInquiryStatus.approved,
            session_token=None,
            template_id=FAKE_TEMPLATE_ID,
        )
        db.add(inquiry)
        await db.commit()

        resp = await client.get("/persona/inquiry/status", headers=driver_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["persona_inquiry_id"] == "inq_status_test_001"
        assert data["status"] == "approved"

    async def test_passenger_cannot_check_kyc_status(self, client, passenger_headers):
        resp = await client.get("/persona/inquiry/status", headers=passenger_headers)
        assert resp.status_code == 403


# ── API: POST /persona/webhook ────────────────────────────────────────────────

class TestPersonaWebhook:
    async def test_unknown_event_returns_200(self, client):
        payload = _persona_webhook_payload("inquiry.unknown_event")
        raw = json.dumps(payload).encode()
        sig = _make_signature(raw, FAKE_SECRET)
        with patch("core.config.settings.PERSONA_WEBHOOK_SECRET", FAKE_SECRET):
            resp = await client.post(
                "/persona/webhook",
                content=raw,
                headers={"content-type": "application/json", "persona-signature": sig},
            )
        assert resp.status_code == 200
        assert resp.json()["received"] is True

    async def test_invalid_json_returns_200(self, client):
        with patch("core.config.settings.PERSONA_WEBHOOK_SECRET", ""):
            resp = await client.post(
                "/persona/webhook",
                content=b"not json",
                headers={"content-type": "application/json"},
            )
        assert resp.status_code == 200

    async def test_valid_signature_accepted(self, client):
        payload = _persona_webhook_payload("inquiry.created", "inq_sig_test")
        raw = json.dumps(payload).encode()
        sig = _make_signature(raw, FAKE_SECRET)

        with patch("core.config.settings.PERSONA_WEBHOOK_SECRET", FAKE_SECRET):
            resp = await client.post(
                "/persona/webhook",
                content=raw,
                headers={
                    "content-type": "application/json",
                    "persona-signature": sig,
                },
            )
        assert resp.status_code == 200

    async def test_invalid_signature_rejected(self, client):
        payload = _persona_webhook_payload()
        raw = json.dumps(payload).encode()

        with patch("core.config.settings.PERSONA_WEBHOOK_SECRET", FAKE_SECRET):
            resp = await client.post(
                "/persona/webhook",
                content=raw,
                headers={
                    "content-type": "application/json",
                    "persona-signature": "t=9999,v1=deadbeef",
                },
            )
        assert resp.status_code == 401

    async def test_approved_event_updates_compliance(
        self, client, driver, db
    ):
        """inquiry.approved webhook → DriverComplianceProfile set to approved."""
        # Pre-create an inquiry record for the driver
        inquiry = PersonaInquiry(
            driver_id=driver.id,
            persona_inquiry_id="inq_approved_test_001",
            status=PersonaInquiryStatus.completed,
            template_id=FAKE_TEMPLATE_ID,
        )
        db.add(inquiry)
        await db.commit()

        payload = _persona_webhook_payload(
            "inquiry.approved", "inq_approved_test_001"
        )
        raw = json.dumps(payload).encode()
        sig = _make_signature(raw, FAKE_SECRET)
        with patch("core.config.settings.PERSONA_WEBHOOK_SECRET", FAKE_SECRET):
            resp = await client.post(
                "/persona/webhook",
                content=raw,
                headers={"content-type": "application/json", "persona-signature": sig},
            )
        assert resp.status_code == 200

        # Verify compliance profile was updated
        from sqlalchemy import select
        result = await db.execute(
            select(DriverComplianceProfile).where(
                DriverComplianceProfile.driver_id == driver.id
            )
        )
        profile = result.scalar_one_or_none()
        assert profile is not None
        assert profile.compliance_status == ComplianceStatus.approved
        assert profile.auto_blocked is False

    async def test_declined_event_blocks_driver(
        self, client, driver, db
    ):
        """inquiry.declined webhook → DriverComplianceProfile set to blocked."""
        inquiry = PersonaInquiry(
            driver_id=driver.id,
            persona_inquiry_id="inq_declined_test_001",
            status=PersonaInquiryStatus.completed,
            template_id=FAKE_TEMPLATE_ID,
        )
        db.add(inquiry)
        await db.commit()

        payload = _persona_webhook_payload(
            "inquiry.declined", "inq_declined_test_001"
        )
        raw = json.dumps(payload).encode()
        sig = _make_signature(raw, FAKE_SECRET)
        with patch("core.config.settings.PERSONA_WEBHOOK_SECRET", FAKE_SECRET):
            resp = await client.post(
                "/persona/webhook",
                content=raw,
                headers={"content-type": "application/json", "persona-signature": sig},
            )
        assert resp.status_code == 200

        from sqlalchemy import select
        result = await db.execute(
            select(DriverComplianceProfile).where(
                DriverComplianceProfile.driver_id == driver.id
            )
        )
        profile = result.scalar_one_or_none()
        assert profile is not None
        assert profile.compliance_status == ComplianceStatus.blocked
        assert profile.auto_blocked is True
        assert "declined" in profile.block_reason.lower()

    async def test_webhook_for_unknown_inquiry_returns_200(self, client):
        """Unknown inquiry IDs are silently ignored — never crash."""
        payload = _persona_webhook_payload(
            "inquiry.approved", "inq_completely_unknown_999"
        )
        raw = json.dumps(payload).encode()
        sig = _make_signature(raw, FAKE_SECRET)
        with patch("core.config.settings.PERSONA_WEBHOOK_SECRET", FAKE_SECRET):
            resp = await client.post(
                "/persona/webhook",
                content=raw,
                headers={"content-type": "application/json", "persona-signature": sig},
            )
        assert resp.status_code == 200


# ── API: GET /admin/persona/drivers/{id}/inquiries ────────────────────────────

class TestAdminPersonaInquiries:
    async def test_admin_can_list_driver_inquiries(
        self, client, admin_headers, driver, db
    ):
        inquiry = PersonaInquiry(
            driver_id=driver.id,
            persona_inquiry_id="inq_admin_view_001",
            status=PersonaInquiryStatus.approved,
            template_id=FAKE_TEMPLATE_ID,
        )
        db.add(inquiry)
        await db.commit()

        resp = await client.get(
            f"/persona/admin/drivers/{driver.id}/inquiries",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert any(i["persona_inquiry_id"] == "inq_admin_view_001" for i in data)

    async def test_non_admin_cannot_access(self, client, driver_headers, driver):
        resp = await client.get(
            f"/persona/admin/drivers/{driver.id}/inquiries",
            headers=driver_headers,
        )
        assert resp.status_code == 403

    async def test_returns_empty_list_for_driver_with_no_inquiries(
        self, client, admin_headers
    ):
        unknown_id = uuid.uuid4()
        resp = await client.get(
            f"/persona/admin/drivers/{unknown_id}/inquiries",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json() == []

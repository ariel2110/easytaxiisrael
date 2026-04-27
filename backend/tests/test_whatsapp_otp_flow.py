"""
End-to-end tests for the WhatsApp OTP authentication flow.

These tests simulate the FULL login journey:
  1. User requests OTP → WhatsApp message sent
  2. User submits code → gets JWT tokens
  3. Tokens used to access protected endpoints

Tests cover: passengers, drivers, admin — and edge cases like
wrong code, expired code, inactive user, double-use.
"""
from unittest.mock import AsyncMock, call, patch

import pytest

from tests.conftest import make_user
from models.user import UserRole


WHATSAPP_SEND_OTP = "services.whatsapp.send_otp"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _request_and_get_otp(client, phone: str) -> str:
    """Request OTP and return the code (DEBUG mode exposes it in response)."""
    with patch(WHATSAPP_SEND_OTP, return_value=True):
        resp = await client.post("/auth/otp/request", json={"phone": phone})
    assert resp.status_code == 200
    assert "otp" in resp.json(), "DEBUG mode must expose OTP"
    return resp.json()["otp"]


async def _full_login(client, phone: str, role: str = "passenger") -> dict:
    """Full OTP login; returns token response dict."""
    otp = await _request_and_get_otp(client, phone)
    resp = await client.post(
        "/auth/otp/verify", json={"phone": phone, "otp": otp, "role": role}
    )
    assert resp.status_code == 200
    return resp.json()


# ---------------------------------------------------------------------------
# Passenger OTP flow
# ---------------------------------------------------------------------------

class TestPassengerOtpFlow:
    async def test_new_passenger_can_register_via_otp(self, client):
        tokens = await _full_login(client, "+972501500001", role="passenger")
        assert tokens["role"] == "passenger"
        assert tokens["access_token"]
        assert tokens["refresh_token"]

    async def test_existing_passenger_can_login_again(self, client, db):
        phone = "+972501500002"
        # First login creates the user
        await _full_login(client, phone, role="passenger")
        # Second login should succeed with a NEW otp
        tokens = await _full_login(client, phone, role="passenger")
        assert tokens["role"] == "passenger"

    async def test_otp_is_sent_to_whatsapp(self, client):
        captured: list = []

        async def _fake_send_otp(phone: str, otp: str) -> bool:
            captured.append((phone, otp))
            return True

        with patch(WHATSAPP_SEND_OTP, side_effect=_fake_send_otp):
            resp = await client.post("/auth/otp/request", json={"phone": "+972501500003"})
        assert resp.status_code == 200
        # WhatsApp was called
        assert len(captured) == 1
        assert captured[0][0] == "+972501500003"
        # OTP is 6 digits
        assert len(captured[0][1]) == 6
        assert captured[0][1].isdigit()

    async def test_otp_message_contains_code(self, client):
        """The WhatsApp message body should contain the OTP code."""
        sent_messages: list[str] = []

        async def _fake_send_text(phone: str, text: str) -> bool:
            sent_messages.append(text)
            return True

        with patch("services.whatsapp.send_text", side_effect=_fake_send_text):
            resp = await client.post("/auth/otp/request", json={"phone": "+972501500004"})

        otp = resp.json().get("otp", "")
        assert any(otp in msg for msg in sent_messages), \
            "OTP code must appear in the WhatsApp message"

    async def test_wrong_otp_returns_401(self, client):
        phone = "+972501500005"
        await _request_and_get_otp(client, phone)  # creates the OTP in Redis
        resp = await client.post(
            "/auth/otp/verify",
            json={"phone": phone, "otp": "000000", "role": "passenger"},
        )
        assert resp.status_code == 401

    async def test_otp_cannot_be_reused(self, client):
        phone = "+972501500006"
        otp = await _request_and_get_otp(client, phone)
        # First use — ok
        r1 = await client.post(
            "/auth/otp/verify", json={"phone": phone, "otp": otp, "role": "passenger"}
        )
        assert r1.status_code == 200
        # Second use — rejected
        r2 = await client.post(
            "/auth/otp/verify", json={"phone": phone, "otp": otp, "role": "passenger"}
        )
        assert r2.status_code == 401

    async def test_authenticated_passenger_can_access_me(self, client):
        phone = "+972501500007"
        tokens = await _full_login(client, phone)
        resp = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "passenger"


# ---------------------------------------------------------------------------
# Driver OTP flow
# ---------------------------------------------------------------------------

class TestDriverOtpFlow:
    async def test_driver_can_register_via_otp(self, client):
        tokens = await _full_login(client, "+972502500001", role="driver")
        assert tokens["role"] == "driver"

    async def test_driver_token_grants_driver_role(self, client):
        phone = "+972502500002"
        tokens = await _full_login(client, phone, role="driver")
        resp = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "driver"

    async def test_driver_gets_kyc_url_after_login(self, client):
        """After phone OTP, driver should receive a Persona KYC URL."""
        import httpx
        import respx
        from unittest.mock import patch as _patch

        persona_response = {
            "data": {
                "id": "inq_driver_flow_001",
                "attributes": {
                    "status": "created",
                    "session-token": "sess_driver_flow_tok",
                },
            }
        }
        with (
            _patch("core.config.settings.PERSONA_API_KEY", "persona_sandbox_test"),
            _patch("core.config.settings.PERSONA_TEMPLATE_ID", "itmpl_test"),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://withpersona.com/api/v1/inquiries").mock(
                return_value=httpx.Response(201, json=persona_response)
            )
            tokens = await _full_login(client, "+972502500010", role="driver")

        assert tokens["kyc_url"] is not None
        assert "inq_driver_flow_001" in tokens["kyc_url"]
        assert "sess_driver_flow_tok" in tokens["kyc_url"]

    async def test_passenger_does_not_get_kyc_url(self, client):
        """Passengers do not go through KYC — kyc_url must be null."""
        tokens = await _full_login(client, "+972501500010", role="passenger")
        assert tokens.get("kyc_url") is None

    async def test_driver_login_succeeds_even_if_persona_down(self, client):
        """If Persona API is unreachable, login still returns tokens."""
        import httpx
        import respx

        with (
            patch("core.config.settings.PERSONA_API_KEY", "persona_sandbox_test"),
            patch("core.config.settings.PERSONA_TEMPLATE_ID", "itmpl_test"),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://withpersona.com/api/v1/inquiries").mock(
                side_effect=httpx.ConnectError("unreachable")
            )
            tokens = await _full_login(client, "+972502500011", role="driver")

        assert "access_token" in tokens
        assert tokens["kyc_url"] is None  # graceful fallback

    async def test_driver_cannot_request_ride(self, client):
        phone = "+972502500003"
        tokens = await _full_login(client, phone, role="driver")
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        with patch("services.whatsapp.send_text", return_value=True), \
             patch("services.push.send_event", return_value=None):
            resp = await client.post("/rides", json={
                "pickup_lat": 32.08, "pickup_lng": 34.78,
                "dropoff_lat": 32.10, "dropoff_lng": 34.80,
            }, headers=headers)
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Inactive user
# ---------------------------------------------------------------------------

class TestInactiveUser:
    async def test_inactive_user_token_rejected_on_protected_endpoint(self, client, db):
        user = await make_user(db, "972509500001", UserRole.passenger, active=False)
        from core.security import create_access_token
        token = create_access_token(str(user.id), "passenger")
        resp = await client.get(
            "/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# WhatsApp failure resilience
# ---------------------------------------------------------------------------

class TestWhatsAppFailureResilience:
    async def test_otp_request_succeeds_even_if_whatsapp_fails(self, client):
        """If WhatsApp send fails, OTP request should still return 200.
        The OTP is stored in Redis; delivery failure is non-fatal."""
        with patch(WHATSAPP_SEND_OTP, return_value=False):
            resp = await client.post("/auth/otp/request", json={"phone": "+972501600001"})
        # Backend should still return 200 — WhatsApp is best-effort
        assert resp.status_code == 200

    async def test_otp_still_valid_if_whatsapp_fails(self, client):
        """OTP in Redis is independent of WhatsApp delivery — user can still verify."""
        with patch(WHATSAPP_SEND_OTP, return_value=False):
            req_resp = await client.post("/auth/otp/request", json={"phone": "+972501600002"})
        assert req_resp.status_code == 200
        otp = req_resp.json().get("otp")
        assert otp is not None  # DEBUG mode
        # Verify still works
        resp = await client.post(
            "/auth/otp/verify",
            json={"phone": "+972501600002", "otp": otp, "role": "passenger"},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Token refresh after WhatsApp login
# ---------------------------------------------------------------------------

class TestTokenRefreshAfterLogin:
    async def test_refresh_token_from_otp_login_works(self, client):
        phone = "+972501700001"
        tokens = await _full_login(client, phone)
        refresh = tokens["refresh_token"]
        resp = await client.post("/auth/token/refresh", json={"refresh_token": refresh})
        assert resp.status_code == 200
        new_tokens = resp.json()
        # A new refresh token must be issued (rotated)
        assert new_tokens["refresh_token"] != refresh
        assert "access_token" in new_tokens

    async def test_logout_invalidates_refresh_token(self, client):
        phone = "+972501700002"
        tokens = await _full_login(client, phone)
        # Logout
        await client.post(
            "/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        # Refresh with old token should fail
        resp = await client.post(
            "/auth/token/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 401

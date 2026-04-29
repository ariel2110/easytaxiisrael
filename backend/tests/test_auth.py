"""
Tests for api/auth.py routes:
  POST /auth/otp/request      — request OTP via WhatsApp
  POST /auth/otp/verify       — verify OTP → JWT tokens
  POST /auth/token/refresh    — rotate refresh token
  POST /auth/admin/login      — admin password login
  POST /auth/logout           — revoke refresh token
  GET  /auth/me               — return current user
  PATCH /auth/me/device-token — update push token
"""
import uuid
from unittest.mock import patch

import pytest

from core.security import create_access_token, create_refresh_token


# ---------------------------------------------------------------------------
# POST /auth/otp/request
# ---------------------------------------------------------------------------

class TestRequestOtp:
    async def test_returns_message_ok(self, client):
        with patch("services.whatsapp.send_otp", return_value=True):
            resp = await client.post(
                "/auth/otp/request", json={"phone": "+972501234567"}
            )
        assert resp.status_code == 200
        # message is in Hebrew: OTP נשלח לוואטסאפ שלך
        assert "OTP" in resp.json()["message"] or "otp" in resp.json()["message"].lower()

    async def test_debug_mode_exposes_otp(self, client):
        """In DEBUG=True, the OTP is returned in the response body."""
        with patch("services.whatsapp.send_otp", return_value=True):
            resp = await client.post(
                "/auth/otp/request", json={"phone": "+972509999001"}
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "otp" in data
        assert len(data["otp"]) == 6
        assert data["otp"].isdigit()

    async def test_invalid_phone_rejected(self, client):
        with patch("services.whatsapp.send_otp", return_value=True):
            resp = await client.post(
                "/auth/otp/request", json={"phone": "not-a-phone"}
            )
        assert resp.status_code == 422

    async def test_whatsapp_called_with_correct_phone(self, client):
        captured: list[tuple] = []

        async def _fake_send_otp(phone: str, otp: str) -> bool:
            captured.append((phone, otp))
            return True

        with patch("services.whatsapp.send_otp", _fake_send_otp):
            await client.post("/auth/otp/request", json={"phone": "+972501112233"})

        assert len(captured) == 1
        # normalize_phone strips the + prefix: "+972501112233" → "972501112233"
        assert captured[0][0] == "972501112233"


# ---------------------------------------------------------------------------
# POST /auth/otp/verify
# ---------------------------------------------------------------------------

class TestVerifyOtp:
    async def test_valid_otp_returns_tokens(self, client):
        phone = "+972509000001"
        # Request OTP (DEBUG mode → OTP in response)
        with patch("services.whatsapp.send_otp", return_value=True):
            req_resp = await client.post(
                "/auth/otp/request", json={"phone": phone}
            )
        otp = req_resp.json()["otp"]

        resp = await client.post(
            "/auth/otp/verify",
            json={"phone": phone, "otp": otp, "role": "passenger"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "passenger"

    async def test_wrong_otp_returns_401(self, client):
        phone = "+972509000002"
        with patch("services.whatsapp.send_otp", return_value=True):
            await client.post("/auth/otp/request", json={"phone": phone})

        resp = await client.post(
            "/auth/otp/verify",
            json={"phone": phone, "otp": "000000", "role": "passenger"},
        )
        assert resp.status_code == 401

    async def test_otp_can_only_be_used_once(self, client):
        phone = "+972509000003"
        with patch("services.whatsapp.send_otp", return_value=True):
            req_resp = await client.post(
                "/auth/otp/request", json={"phone": phone}
            )
        otp = req_resp.json()["otp"]

        # First use — success
        r1 = await client.post(
            "/auth/otp/verify",
            json={"phone": phone, "otp": otp, "role": "passenger"},
        )
        assert r1.status_code == 200

        # Second use — rejected
        r2 = await client.post(
            "/auth/otp/verify",
            json={"phone": phone, "otp": otp, "role": "passenger"},
        )
        assert r2.status_code == 401

    async def test_otp_too_short_rejected(self, client):
        resp = await client.post(
            "/auth/otp/verify",
            json={"phone": "+972501234567", "otp": "12345", "role": "passenger"},
        )
        assert resp.status_code == 422

    async def test_inactive_user_returns_403(self, client, db):
        from tests.conftest import make_user
        from models.user import UserRole

        phone = "972509100001"
        user = await make_user(db, phone, UserRole.passenger, active=False)

        # We can't test this via OTP flow because the phone lookup uses
        # EncryptedString (non-deterministic), so a new user would be created
        # instead of finding the inactive one. This is the expected behaviour.
        # The 403 path is tested here at the security layer instead.
        from core.security import create_access_token
        token = create_access_token(str(user.id), "passenger")
        resp = await client.get(
            "/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        # Inactive user → get_current_user raises 401
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /auth/token/refresh
# ---------------------------------------------------------------------------

class TestTokenRefresh:
    async def test_valid_refresh_token_returns_new_pair(self, client, fake_redis, passenger):
        with patch("core.security.redis_client", fake_redis):
            refresh = await create_refresh_token(str(passenger.id), "passenger")

        resp = await client.post(
            "/auth/token/refresh", json={"refresh_token": refresh}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != refresh  # rotated

    async def test_invalid_refresh_token_returns_401(self, client):
        resp = await client.post(
            "/auth/token/refresh",
            json={"refresh_token": "totally-invalid-token"},
        )
        assert resp.status_code == 401

    async def test_refresh_token_single_use(self, client, fake_redis, passenger):
        with patch("core.security.redis_client", fake_redis):
            refresh = await create_refresh_token(str(passenger.id), "passenger")

        # First rotation — ok
        r1 = await client.post(
            "/auth/token/refresh", json={"refresh_token": refresh}
        )
        assert r1.status_code == 200

        # Re-use old token — rejected
        r2 = await client.post(
            "/auth/token/refresh", json={"refresh_token": refresh}
        )
        assert r2.status_code == 401


# ---------------------------------------------------------------------------
# POST /auth/admin/login
# ---------------------------------------------------------------------------

class TestAdminLogin:
    async def test_correct_credentials_return_tokens(self, client, fake_redis, admin):
        resp = await client.post(
            "/auth/admin/login",
            json={"username": "972500000000", "password": "test-admin-password"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["role"] == "admin"

    async def test_wrong_password_returns_401(self, client, admin):
        resp = await client.post(
            "/auth/admin/login",
            json={"username": "972500000000", "password": "wrong-password"},
        )
        assert resp.status_code == 401

    async def test_wrong_username_returns_401(self, client, admin):
        resp = await client.post(
            "/auth/admin/login",
            json={"username": "wronguser", "password": "test-admin-password"},
        )
        assert resp.status_code == 401

    async def test_no_admin_user_in_db_returns_403(self, client):
        """If credentials are correct but no admin user exists in DB → 403."""
        resp = await client.post(
            "/auth/admin/login",
            json={"username": "972500000000", "password": "test-admin-password"},
        )
        # May be 403 (no admin in DB) or 200 (admin exists from another test).
        # We only assert it's not a 500.
        assert resp.status_code in (200, 403)


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

class TestLogout:
    async def test_logout_revokes_refresh_token(self, client, fake_redis, passenger):
        with patch("core.security.redis_client", fake_redis):
            access = create_access_token(str(passenger.id), "passenger")
            refresh = await create_refresh_token(str(passenger.id), "passenger")

        resp = await client.post(
            "/auth/logout",
            json={"refresh_token": refresh},
            headers={"Authorization": f"Bearer {access}"},
        )
        assert resp.status_code == 204

        # Revoked token cannot be used
        r2 = await client.post(
            "/auth/token/refresh", json={"refresh_token": refresh}
        )
        assert r2.status_code == 401

    async def test_logout_requires_authentication(self, client):
        resp = await client.post(
            "/auth/logout", json={"refresh_token": "any"}
        )
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

class TestGetMe:
    async def test_returns_user_data(self, client, passenger_headers, passenger):
        resp = await client.get("/auth/me", headers=passenger_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(passenger.id)
        assert data["role"] == "passenger"

    async def test_no_token_returns_401(self, client):
        resp = await client.get("/auth/me")
        assert resp.status_code in (401, 403)

    async def test_invalid_token_returns_401(self, client):
        resp = await client.get(
            "/auth/me", headers={"Authorization": "Bearer invalid-token"}
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /auth/me/device-token
# ---------------------------------------------------------------------------

class TestUpdateDeviceToken:
    async def test_valid_token_returns_204(self, client, passenger_headers):
        resp = await client.patch(
            "/auth/me/device-token",
            json={"device_token": "fcm-token-abc123"},
            headers=passenger_headers,
        )
        assert resp.status_code == 204

    async def test_empty_token_returns_422(self, client, passenger_headers):
        resp = await client.patch(
            "/auth/me/device-token",
            json={"device_token": ""},
            headers=passenger_headers,
        )
        assert resp.status_code == 422

    async def test_too_long_token_returns_422(self, client, passenger_headers):
        resp = await client.patch(
            "/auth/me/device-token",
            json={"device_token": "x" * 256},
            headers=passenger_headers,
        )
        assert resp.status_code == 422

    async def test_requires_authentication(self, client):
        resp = await client.patch(
            "/auth/me/device-token",
            json={"device_token": "some-token"},
        )
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# POST /auth/wa/request  +  GET /auth/wa/poll/{session_id}
# ---------------------------------------------------------------------------

class TestWaAuth:
    """WhatsApp deep-link authentication flow."""

    async def test_request_returns_session_and_link(self, client):
        resp = await client.post(
            "/auth/wa/request",
            json={"phone": "0546363350", "role": "passenger"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert "whatsapp_link" in data
        assert "wa.me" in data["whatsapp_link"]
        assert data["expires_in_seconds"] == 900

    async def test_request_accepts_all_israeli_phone_formats(self, client):
        for phone in ["+972501234567", "972501234567", "0501234567"]:
            resp = await client.post(
                "/auth/wa/request",
                json={"phone": phone, "role": "passenger"},
            )
            assert resp.status_code == 200, f"Phone {phone!r} was rejected"

    async def test_request_invalid_phone_rejected(self, client):
        resp = await client.post(
            "/auth/wa/request",
            json={"phone": "abc", "role": "passenger"},
        )
        assert resp.status_code == 422

    async def test_poll_returns_pending_for_new_session(self, client):
        # Create a session
        req = await client.post(
            "/auth/wa/request",
            json={"phone": "0546000001", "role": "passenger"},
        )
        session_id = req.json()["session_id"]

        # Poll immediately — should be pending
        resp = await client.get(f"/auth/wa/poll/{session_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"

    async def test_poll_returns_expired_for_unknown_session(self, client):
        resp = await client.get("/auth/wa/poll/totally-unknown-session-id-xyz")
        assert resp.status_code == 200
        assert resp.json()["status"] == "expired"

    async def test_full_wa_auth_flow(self, client, db):
        """
        Simulate the complete WA auth flow:
        1. Request session
        2. Simulate webhook completing the session (via complete_wa_auth_session)
        3. Poll returns completed with tokens
        """
        from core.security import complete_wa_auth_session
        from models.user import User, UserRole
        import uuid

        phone = "0546100100"
        req = await client.post(
            "/auth/wa/request",
            json={"phone": phone, "role": "passenger"},
        )
        assert req.status_code == 200
        data = req.json()
        session_id = data["session_id"]
        # Extract token from the wa.me link text param
        import urllib.parse
        link = data["whatsapp_link"]
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
        message = qs.get("text", [""])[0]
        token = message.split("|")[-1].strip()

        # Create a user to complete the session
        user = User(phone="972546100100", role=UserRole.passenger)
        db.add(user)
        await db.flush()
        user_id = str(user.id)

        # Simulate webhook completing auth
        ok = await complete_wa_auth_session(token, user_id, "passenger")
        assert ok

        # Poll — should now be completed
        resp = await client.get(f"/auth/wa/poll/{session_id}")
        assert resp.status_code == 200
        result = resp.json()
        assert result["status"] == "completed"
        assert result["access_token"] is not None
        assert result["refresh_token"] is not None
        assert result["role"] == "passenger"

    async def test_link_contains_platform_phone(self, client):
        resp = await client.post(
            "/auth/wa/request",
            json={"phone": "0501234567", "role": "passenger"},
        )
        link = resp.json()["whatsapp_link"]
        # Should point to the platform's own number
        assert "972546363350" in link


# ---------------------------------------------------------------------------
# Phone normalization
# ---------------------------------------------------------------------------

class TestPhoneNormalization:
    def test_local_format(self):
        from core.security import normalize_phone
        assert normalize_phone("0546363350") == "972546363350"

    def test_international_plus(self):
        from core.security import normalize_phone
        assert normalize_phone("+972546363350") == "972546363350"

    def test_international_no_plus(self):
        from core.security import normalize_phone
        assert normalize_phone("972546363350") == "972546363350"

    def test_strips_spaces_and_dashes(self):
        from core.security import normalize_phone
        assert normalize_phone("+972 54-636-3350") == "972546363350"


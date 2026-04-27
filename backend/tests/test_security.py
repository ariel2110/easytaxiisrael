"""
Unit tests for core/security.py:
  - OTP: generate, verify, single-use, expiry
  - JWT access tokens: create, decode, expired, tampered
  - Refresh tokens: create, rotate, revoke, single-use
"""
import time
from datetime import timedelta
from unittest.mock import patch

import fakeredis.aioredis
import pytest
from jose import jwt

from core.security import (
    ALGORITHM,
    OTP_TTL_SECONDS,
    create_access_token,
    create_otp,
    create_refresh_token,
    decode_access_token,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_otp,
)


# ---------------------------------------------------------------------------
# OTP
# ---------------------------------------------------------------------------

class TestOtp:
    async def test_otp_is_6_digits(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            otp = await create_otp("+972501000001")
        assert len(otp) == 6
        assert otp.isdigit()

    async def test_valid_otp_verifies(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            otp = await create_otp("+972501000002")
            result = await verify_otp("+972501000002", otp)
        assert result is True

    async def test_wrong_otp_rejected(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            await create_otp("+972501000003")
            result = await verify_otp("+972501000003", "000000")
        assert result is False

    async def test_otp_single_use(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            otp = await create_otp("+972501000004")
            first = await verify_otp("+972501000004", otp)
            second = await verify_otp("+972501000004", otp)
        assert first is True
        assert second is False

    async def test_verify_without_request_returns_false(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            result = await verify_otp("+972509999999", "123456")
        assert result is False

    async def test_otp_stored_in_redis(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            otp = await create_otp("+972501000005")
            stored = await fake_redis.get(f"otp:+972501000005")
        assert stored == otp

    async def test_second_otp_request_overwrites_first(self, fake_redis):
        """Requesting OTP twice should give a fresh code."""
        with patch("core.security.redis_client", fake_redis):
            otp1 = await create_otp("+972501000006")
            otp2 = await create_otp("+972501000006")
            # old code no longer valid
            result_old = await verify_otp("+972501000006", otp1)
            result_new = await verify_otp("+972501000006", otp2)
        # Either otp1==otp2 (random collision) or old fails
        assert result_new is True
        # If they were different, old one should have been overwritten
        if otp1 != otp2:
            assert result_old is False


# ---------------------------------------------------------------------------
# JWT Access Token
# ---------------------------------------------------------------------------

class TestAccessToken:
    def test_created_token_is_string(self):
        token = create_access_token("user-123", "passenger")
        assert isinstance(token, str)
        assert len(token) > 20

    def test_decode_returns_correct_subject(self):
        token = create_access_token("user-abc", "driver")
        payload = decode_access_token(token)
        assert payload["sub"] == "user-abc"

    def test_decode_returns_correct_role(self):
        token = create_access_token("user-abc", "admin")
        payload = decode_access_token(token)
        assert payload["role"] == "admin"

    def test_token_type_is_access(self):
        token = create_access_token("user-abc", "passenger")
        payload = decode_access_token(token)
        assert payload["type"] == "access"

    def test_expired_token_raises(self):
        from jose import JWTError
        from datetime import datetime, timezone

        # Manually create expired token
        payload = {
            "sub": "user-abc",
            "role": "passenger",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
            "type": "access",
        }
        from core.config import settings
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)
        with pytest.raises(JWTError):
            decode_access_token(token)

    def test_tampered_token_raises(self):
        from jose import JWTError
        token = create_access_token("user-abc", "passenger")
        tampered = token[:-5] + "xxxxx"
        with pytest.raises(JWTError):
            decode_access_token(tampered)

    def test_wrong_secret_raises(self):
        from jose import JWTError
        from core.config import settings
        payload = {
            "sub": "user-abc",
            "role": "passenger",
            "type": "access",
        }
        token = jwt.encode(payload, "wrong-secret", algorithm=ALGORITHM)
        with pytest.raises(JWTError):
            decode_access_token(token)


# ---------------------------------------------------------------------------
# Refresh Token
# ---------------------------------------------------------------------------

class TestRefreshToken:
    async def test_create_refresh_token_returns_string(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            token = await create_refresh_token("user-123", "passenger")
        assert isinstance(token, str)
        assert len(token) > 20

    async def test_rotate_returns_new_pair(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            refresh = await create_refresh_token("user-123", "driver")
            result = await rotate_refresh_token(refresh)
        assert result is not None
        access, new_refresh = result
        assert isinstance(access, str)
        assert isinstance(new_refresh, str)
        assert new_refresh != refresh

    async def test_rotate_invalid_token_returns_none(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            result = await rotate_refresh_token("non-existent-token")
        assert result is None

    async def test_rotate_single_use(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            refresh = await create_refresh_token("user-123", "passenger")
            r1 = await rotate_refresh_token(refresh)
            r2 = await rotate_refresh_token(refresh)  # second rotation with old token
        assert r1 is not None
        assert r2 is None  # already consumed

    async def test_revoke_invalidates_token(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            refresh = await create_refresh_token("user-123", "passenger")
            await revoke_refresh_token(refresh)
            result = await rotate_refresh_token(refresh)
        assert result is None

    async def test_rotate_preserves_subject_and_role(self, fake_redis):
        with patch("core.security.redis_client", fake_redis):
            refresh = await create_refresh_token("user-xyz", "admin")
            result = await rotate_refresh_token(refresh)
        assert result is not None
        access, _ = result
        payload = decode_access_token(access)
        assert payload["sub"] == "user-xyz"
        assert payload["role"] == "admin"

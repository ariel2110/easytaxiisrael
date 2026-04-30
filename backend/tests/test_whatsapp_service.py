"""
Unit tests for services/whatsapp.py.

All outbound httpx calls are intercepted with respx so no real network
traffic is made. Tests verify:
  - Phone normalisation
  - send_text success / failure paths
  - High-level notification helpers (message content + call shape)
"""
from unittest.mock import AsyncMock, patch

import pytest
import respx
from httpx import ConnectError, Response

# ---------------------------------------------------------------------------
# _normalize
# ---------------------------------------------------------------------------

class TestNormalizePhone:
    def test_strips_plus_prefix(self):
        from services.whatsapp import _normalize
        assert _normalize("+9725051234") == "9725051234"

    def test_converts_leading_zero_to_972(self):
        from services.whatsapp import _normalize
        assert _normalize("0501234567") == "972501234567"

    def test_already_international(self):
        from services.whatsapp import _normalize
        assert _normalize("972501234567") == "972501234567"

    def test_strips_hyphens_and_spaces(self):
        from services.whatsapp import _normalize
        assert _normalize("+972 50-123-4567") == "972501234567"

    def test_non_israeli_number_kept_as_is(self):
        # normalize_phone only prepends 972 to numbers starting with '0' (Israeli local format).
        # Non-Israeli international numbers (e.g. US) must be kept unchanged.
        from services.whatsapp import _normalize
        assert _normalize("14155550000") == "14155550000"


# ---------------------------------------------------------------------------
# send_text
# ---------------------------------------------------------------------------

SEND_TEXT_URL = "http://evolution-api-test:8080/message/sendText/test-instance"


class TestSendText:
    @respx.mock
    async def test_returns_true_on_200(self):
        from services.whatsapp import send_text

        respx.post(SEND_TEXT_URL).mock(
            return_value=Response(200, json={"key": {"id": "msg-001"}})
        )
        result = await send_text("0501234567", "שלום")
        assert result is True

    @respx.mock
    async def test_returns_true_on_201(self):
        from services.whatsapp import send_text

        respx.post(SEND_TEXT_URL).mock(return_value=Response(201, json={}))
        assert await send_text("0501234567", "test") is True

    @respx.mock
    async def test_returns_false_on_non_200(self):
        from services.whatsapp import send_text

        respx.post(SEND_TEXT_URL).mock(return_value=Response(500, text="error"))
        assert await send_text("0501234567", "test") is False

    @respx.mock
    async def test_returns_false_on_network_error(self):
        from services.whatsapp import send_text

        respx.post(SEND_TEXT_URL).mock(side_effect=ConnectError("timeout"))
        assert await send_text("0501234567", "test") is False

    @respx.mock
    async def test_sends_correct_payload(self):
        from services.whatsapp import send_text

        route = respx.post(SEND_TEXT_URL).mock(
            return_value=Response(200, json={})
        )
        await send_text("0501234567", "היי")
        request = route.calls.last.request
        import json
        body = json.loads(request.content)
        assert body["number"] == "972501234567"
        assert body["textMessage"]["text"] == "היי"


# ---------------------------------------------------------------------------
# send_otp
# ---------------------------------------------------------------------------

class TestSendOtp:
    async def test_otp_appears_in_message(self):
        from services.whatsapp import send_otp

        captured: list[str] = []

        async def _fake_send(phone: str, text: str) -> bool:
            captured.append(text)
            return True

        with patch("services.whatsapp.send_text", _fake_send):
            result = await send_otp("0501234567", "123456")

        assert result is True
        assert "123456" in captured[0]

    async def test_otp_message_is_hebrew(self):
        from services.whatsapp import send_otp

        captured: list[str] = []

        async def _fake_send(phone: str, text: str) -> bool:
            captured.append(text)
            return True

        with patch("services.whatsapp.send_text", _fake_send):
            await send_otp("0501234567", "999888")

        # Should contain Hebrew characters
        assert any("\u05d0" <= c <= "\u05ea" for c in captured[0])


# ---------------------------------------------------------------------------
# Notification helpers
# ---------------------------------------------------------------------------

class TestNotifications:
    async def _capture_send(self, fn, *args):
        """Call fn with mocked send_text; return list of (phone, text) calls."""
        calls: list[tuple[str, str]] = []

        async def _fake(phone: str, text: str) -> bool:
            calls.append((phone, text))
            return True

        with patch("services.whatsapp.send_text", _fake):
            await fn(*args)

        return calls

    async def test_notify_ride_assigned_messages_passenger(self):
        from services.whatsapp import notify_ride_assigned
        import uuid

        ride_id = uuid.uuid4()
        calls = await self._capture_send(
            notify_ride_assigned, "0501111111", "0502222222", ride_id
        )
        assert len(calls) == 1
        phone, text = calls[0]
        # notify_* passes the raw phone to send_text; normalization happens inside send_text
        assert phone == "0501111111"
        assert str(ride_id)[:8] in text

    async def test_notify_ride_started_messages_passenger(self):
        from services.whatsapp import notify_ride_started
        import uuid

        ride_id = uuid.uuid4()
        calls = await self._capture_send(notify_ride_started, "0501111111", ride_id)
        assert len(calls) == 1
        assert calls[0][0] == "0501111111"

    async def test_notify_ride_completed_includes_fare(self):
        from services.whatsapp import notify_ride_completed
        import uuid

        ride_id = uuid.uuid4()
        calls = await self._capture_send(
            notify_ride_completed, "0501111111", 42.50, ride_id
        )
        assert len(calls) == 1
        _, text = calls[0]
        assert "42.50" in text

    async def test_notify_ride_cancelled_by_passenger(self):
        from services.whatsapp import notify_ride_cancelled
        import uuid

        ride_id = uuid.uuid4()
        calls = await self._capture_send(
            notify_ride_cancelled, "0501111111", ride_id, "passenger"
        )
        assert len(calls) == 1
        _, text = calls[0]
        assert str(ride_id)[:8] in text

    async def test_notify_ride_cancelled_by_driver(self):
        from services.whatsapp import notify_ride_cancelled
        import uuid

        ride_id = uuid.uuid4()
        calls = await self._capture_send(
            notify_ride_cancelled, "0502222222", ride_id, "driver"
        )
        assert len(calls) == 1

    async def test_notify_driver_new_ride_includes_pickup(self):
        from services.whatsapp import notify_driver_new_ride
        import uuid

        ride_id = uuid.uuid4()
        calls = await self._capture_send(
            notify_driver_new_ride, "0502222222", ride_id, "תל אביב, רחוב דיזנגוף 1"
        )
        assert len(calls) == 1
        _, text = calls[0]
        assert "תל אביב" in text
        assert str(ride_id)[:8] in text

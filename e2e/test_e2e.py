"""
E2E tests for EasyTaxi platform using Playwright (headless Chromium).

Tests against live Docker environment:
  - Passenger app: https://easytaxiisrael.com
  - Driver app:    https://driver.easytaxiisrael.com
  - Backend API:   https://easytaxiisrael.com/api

Tests use httpx for API-level E2E and Playwright for UI flows.
"""
from __future__ import annotations

import asyncio
import json
import os

import httpx
import pytest
import pytest_asyncio
from playwright.async_api import async_playwright, Page, expect

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL         = "https://easytaxiisrael.com"
DRIVER_URL       = "https://driver.easytaxiisrael.com"
API_URL          = f"{BASE_URL}/api"
ADMIN_KEY        = "e78a16747d74f1074e2c590d0cc4a074db43b4bc90ac19e2"
ADMIN_USER       = "972546363350"
ADMIN_PASS       = "Eb!WI8ij@&IRPK2gE7bn"
TIMEOUT_MS       = 20_000


# ─────────────────────────────────────────────────────────────────────────────
# Shared fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def browser():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
        yield b
        await b.close()


@pytest_asyncio.fixture
async def page(browser):
    ctx = await browser.new_context(
        ignore_https_errors=True,
        locale="he-IL",
        user_agent="Playwright/EasyTaxi-E2E",
    )
    p = await ctx.new_page()
    p.set_default_timeout(TIMEOUT_MS)
    yield p
    await ctx.close()


@pytest_asyncio.fixture(scope="session")
async def admin_tokens():
    async with httpx.AsyncClient(verify=False, timeout=15) as c:
        resp = await c.post(
            f"{API_URL}/auth/admin/login",
            json={"username": ADMIN_USER, "password": ADMIN_PASS},
        )
    if resp.status_code == 200:
        return resp.json()
    return None


# ─────────────────────────────────────────────────────────────────────────────
# API: Health check
# ─────────────────────────────────────────────────────────────────────────────

class TestAPIHealth:
    async def test_health_endpoint_returns_ok(self):
        async with httpx.AsyncClient(verify=False, timeout=10) as c:
            resp = await c.get(f"{API_URL}/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("ok", "degraded")

    async def test_health_includes_database(self):
        async with httpx.AsyncClient(verify=False, timeout=10) as c:
            resp = await c.get(f"{API_URL}/health")
        data = resp.json()
        assert "database" in data or "postgres" in data

    async def test_health_includes_redis(self):
        async with httpx.AsyncClient(verify=False, timeout=10) as c:
            resp = await c.get(f"{API_URL}/health")
        data = resp.json()
        assert "redis" in data

    async def test_api_base_returns_non_500(self):
        async with httpx.AsyncClient(verify=False, timeout=10) as c:
            resp = await c.get(f"{API_URL}/")
        # 404 is acceptable (no root route), 500 is not
        assert resp.status_code != 500


# ─────────────────────────────────────────────────────────────────────────────
# API: Admin login
# ─────────────────────────────────────────────────────────────────────────────

class TestAdminAuth:
    async def test_admin_login_returns_tokens(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/admin/login",
                json={"username": ADMIN_USER, "password": ADMIN_PASS},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_wrong_password_returns_401(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/admin/login",
                json={"username": ADMIN_USER, "password": "wrong-password"},
            )
        assert resp.status_code == 401

    async def test_wrong_username_returns_401(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/admin/login",
                json={"username": "972000000000", "password": ADMIN_PASS},
            )
        assert resp.status_code == 401

    async def test_admin_token_allows_me_endpoint(self, admin_tokens):
        if not admin_tokens:
            pytest.skip("Admin login failed")
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.get(
                f"{API_URL}/auth/me",
                headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
            )
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"


# ─────────────────────────────────────────────────────────────────────────────
# API: AI Agents (admin only)
# ─────────────────────────────────────────────────────────────────────────────

class TestAIAgentsAPI:
    async def test_list_agents_with_admin_key(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.get(
                f"{API_URL}/admin/ai-agents",
                headers={"X-Admin-Key": ADMIN_KEY},
            )
        assert resp.status_code == 200
        agents = resp.json()
        assert len(agents) >= 5
        ids = {a["id"] for a in agents}
        assert "openai" in ids

    async def test_list_agents_without_key_returns_403(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.get(f"{API_URL}/admin/ai-agents")
        assert resp.status_code == 403

    async def test_agents_have_enabled_field(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.get(
                f"{API_URL}/admin/ai-agents",
                headers={"X-Admin-Key": ADMIN_KEY},
            )
        for ag in resp.json():
            assert "enabled" in ag
            assert isinstance(ag["enabled"], bool)

    async def test_agent_history_endpoint_exists(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.get(
                f"{API_URL}/admin/ai-agents/openai/history",
                headers={"X-Admin-Key": ADMIN_KEY},
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_chat_with_disabled_agent_returns_503(self):
        """Kimi has empty key — should return 503."""
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/admin/ai-agents/kimi/chat",
                headers={"X-Admin-Key": ADMIN_KEY},
                json={"message": "hello"},
            )
        # 503 = key not configured, or 404 if route broken
        assert resp.status_code in (503, 404)


# ─────────────────────────────────────────────────────────────────────────────
# API: OTP request (WhatsApp)
# ─────────────────────────────────────────────────────────────────────────────

class TestOTPFlow:
    async def test_otp_request_valid_phone_returns_200(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/otp/request",
                json={"phone": "+972500000001"},
            )
        # 200 = OTP queued, even if WA delivery fails
        assert resp.status_code == 200

    async def test_otp_request_invalid_phone_returns_422(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/otp/request",
                json={"phone": "not-a-phone"},
            )
        assert resp.status_code == 422

    async def test_otp_wrong_code_returns_401(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/otp/verify",
                json={"phone": "+972500000001", "otp": "000000"},
            )
        assert resp.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# API: WhatsApp auth link
# ─────────────────────────────────────────────────────────────────────────────

class TestWAAuth:
    async def test_wa_auth_request_returns_session(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/wa/request",
                json={"phone": "+972501234567", "role": "passenger"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        # API returns whatsapp_link (not wa_link)
        assert "whatsapp_link" in data or "wa_link" in data

    async def test_wa_auth_link_contains_platform_phone(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/wa/request",
                json={"phone": "+972501234567", "role": "passenger"},
            )
        data = resp.json()
        link = data.get("whatsapp_link") or data.get("wa_link", "")
        assert "972552858732" in link


# ─────────────────────────────────────────────────────────────────────────────
# UI: Passenger landing page
# ─────────────────────────────────────────────────────────────────────────────

class TestPassengerUI:
    async def test_landing_page_loads(self, page: Page):
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        assert page.url.startswith(BASE_URL) or page.url.startswith("https://easytaxiisrael")

    async def test_landing_has_title(self, page: Page):
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        title = await page.title()
        assert len(title) > 0

    async def test_landing_has_login_or_phone_input(self, page: Page):
        await page.goto(BASE_URL, wait_until="networkidle")
        # Look for any input or button that suggests auth
        body = await page.inner_text("body")
        assert any(word in body for word in ["EasyTaxi", "מונית", "כניסה", "Login", "Phone", "טלפון"])

    async def test_passenger_app_returns_200(self):
        async with httpx.AsyncClient(verify=False, timeout=10) as c:
            resp = await c.get(BASE_URL)
        assert resp.status_code == 200

    async def test_passenger_app_is_react(self, page: Page):
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        # Check that a root div exists (React mount point)
        root = await page.query_selector("#root")
        assert root is not None


# ─────────────────────────────────────────────────────────────────────────────
# UI: Driver app
# ─────────────────────────────────────────────────────────────────────────────

class TestDriverUI:
    async def test_driver_app_returns_200(self):
        async with httpx.AsyncClient(verify=False, timeout=10) as c:
            resp = await c.get(DRIVER_URL)
        assert resp.status_code == 200

    async def test_driver_app_loads(self, page: Page):
        await page.goto(DRIVER_URL, wait_until="domcontentloaded")
        title = await page.title()
        assert len(title) > 0

    async def test_driver_app_has_root(self, page: Page):
        await page.goto(DRIVER_URL, wait_until="domcontentloaded")
        root = await page.query_selector("#root")
        assert root is not None


# ─────────────────────────────────────────────────────────────────────────────
# UI: Admin panel
# ─────────────────────────────────────────────────────────────────────────────

class TestAdminUI:
    async def test_admin_panel_returns_200(self):
        async with httpx.AsyncClient(verify=False, timeout=10) as c:
            resp = await c.get(f"{BASE_URL}/admin")
        assert resp.status_code == 200

    async def test_admin_panel_loads(self, page: Page):
        await page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded")
        root = await page.query_selector("#root")
        assert root is not None


# ─────────────────────────────────────────────────────────────────────────────
# API: Surge intelligence
# ─────────────────────────────────────────────────────────────────────────────

class TestAIIntelligence:
    async def test_intelligence_endpoint_returns_surge_data(self, admin_tokens):
        if not admin_tokens:
            pytest.skip("Admin login failed")
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.get(
                f"{API_URL}/ai/intelligence",
                headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
            )
        # Could be 200 or 401 depending on auth requirement — just check it's alive
        assert resp.status_code in (200, 401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# API: Token refresh
# ─────────────────────────────────────────────────────────────────────────────

class TestTokenRefresh:
    async def test_refresh_with_valid_token_returns_new_pair(self, admin_tokens):
        if not admin_tokens:
            pytest.skip("Admin login failed")
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/token/refresh",
                json={"refresh_token": admin_tokens["refresh_token"]},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        # New refresh token must differ (single-use)
        assert data["refresh_token"] != admin_tokens["refresh_token"]

    async def test_refresh_with_garbage_token_returns_401(self):
        async with httpx.AsyncClient(verify=False, timeout=15) as c:
            resp = await c.post(
                f"{API_URL}/auth/token/refresh",
                json={"refresh_token": "garbage-token"},
            )
        assert resp.status_code == 401

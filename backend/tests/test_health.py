"""
Tests for /health endpoint and basic app bootstrap.
"""
from unittest.mock import AsyncMock, patch
import fakeredis.aioredis


class TestHealth:
    async def test_health_returns_ok(self, client, fake_redis):
        with patch("core.redis.redis_client", fake_redis):
            resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        # DB is SQLite in-memory — always ok; redis may vary by patch
        assert data["database"] == "ok"

    async def test_health_degraded_when_redis_unavailable(self, client):
        """When Redis is down the endpoint should return 200 but status='degraded'."""
        bad_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)

        async def _fail_ping():
            raise Exception("Redis down")

        bad_redis.ping = _fail_ping
        with patch("core.redis.redis_client", bad_redis):
            resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["redis"] == "unavailable"
        assert data["status"] == "degraded"

    async def test_health_no_auth_required(self, client):
        """Health endpoint must be public — no token needed."""
        resp = await client.get("/health")
        assert resp.status_code == 200

    async def test_health_response_structure(self, client):
        resp = await client.get("/health")
        data = resp.json()
        assert "status" in data
        assert "database" in data
        assert "redis" in data

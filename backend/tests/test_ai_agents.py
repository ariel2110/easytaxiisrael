"""
Unit tests for /admin/ai-agents endpoints.

Covers:
  GET  /admin/ai-agents                    — list agents
  POST /admin/ai-agents/{id}/chat          — chat with agent
  GET  /admin/ai-agents/{id}/history       — fetch chat history
  PUT  /admin/ai-agents/{id}/key           — update API key
  DELETE /admin/ai-agents/{id}/key         — disable agent
"""
from __future__ import annotations

import json
from unittest.mock import patch

import httpx
import pytest
import respx


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/ai-agents
# ─────────────────────────────────────────────────────────────────────────────

class TestListAgents:
    async def test_returns_list_of_agents(self, client, admin_headers):
        resp = await client.get("/admin/ai-agents", headers=admin_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 5

    async def test_each_agent_has_required_fields(self, client, admin_headers):
        resp = await client.get("/admin/ai-agents", headers=admin_headers)
        for ag in resp.json():
            assert "id" in ag
            assert "name" in ag
            assert "icon" in ag
            assert "models" in ag
            assert "default_model" in ag
            assert "enabled" in ag
            assert "key_masked" in ag

    async def test_known_agent_ids_present(self, client, admin_headers):
        resp = await client.get("/admin/ai-agents", headers=admin_headers)
        ids = {ag["id"] for ag in resp.json()}
        assert {"openai", "anthropic", "gemini"}.issubset(ids)

    async def test_requires_auth(self, client):
        resp = await client.get("/admin/ai-agents")
        assert resp.status_code == 403

    async def test_wrong_bearer_rejected(self, client):
        resp = await client.get("/admin/ai-agents", headers={"Authorization": "Bearer bad"})
        assert resp.status_code == 403

    async def test_disabled_agent_has_empty_key_masked(self, client, admin_headers):
        with patch("api.ai_agents._get_key", return_value=None):
            resp = await client.get("/admin/ai-agents", headers=admin_headers)
        for ag in resp.json():
            if not ag["enabled"]:
                assert ag["key_masked"] == ""

    async def test_enabled_key_is_masked(self, client, admin_headers):
        with patch("api.ai_agents._get_key", return_value="sk-real-key-12345"):
            resp = await client.get("/admin/ai-agents", headers=admin_headers)
        for ag in resp.json():
            if ag["enabled"]:
                assert "sk-real-key-12345" not in ag["key_masked"]


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/ai-agents/{id}/chat
# ─────────────────────────────────────────────────────────────────────────────

class TestChatWithAgent:
    async def test_chat_openai_returns_reply(self, client, admin_headers, fake_redis):
        openai_resp = {"choices": [{"message": {"content": "Hello from OpenAI"}}]}
        with (
            patch("api.ai_agents._get_key", return_value="sk-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://api.openai.com/v1/chat/completions").mock(
                return_value=httpx.Response(200, json=openai_resp)
            )
            resp = await client.post(
                "/admin/ai-agents/openai/chat",
                headers=admin_headers,
                json={"message": "Hello"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["reply"] == "Hello from OpenAI"
        assert data["agent_id"] == "openai"
        assert "model" in data

    async def test_chat_uses_default_model(self, client, admin_headers, fake_redis):
        openai_resp = {"choices": [{"message": {"content": "ok"}}]}
        with (
            patch("api.ai_agents._get_key", return_value="sk-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://api.openai.com/v1/chat/completions").mock(
                return_value=httpx.Response(200, json=openai_resp)
            )
            resp = await client.post(
                "/admin/ai-agents/openai/chat",
                headers=admin_headers,
                json={"message": "ping"},
            )
        assert resp.json()["model"] == "gpt-4o"

    async def test_chat_custom_model_overrides_default(self, client, admin_headers, fake_redis):
        openai_resp = {"choices": [{"message": {"content": "ok"}}]}
        with (
            patch("api.ai_agents._get_key", return_value="sk-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://api.openai.com/v1/chat/completions").mock(
                return_value=httpx.Response(200, json=openai_resp)
            )
            resp = await client.post(
                "/admin/ai-agents/openai/chat",
                headers=admin_headers,
                json={"message": "ping", "model": "gpt-4-turbo"},
            )
        assert resp.json()["model"] == "gpt-4-turbo"

    async def test_chat_anthropic_returns_reply(self, client, admin_headers, fake_redis):
        anthropic_resp = {"content": [{"text": "Hello from Claude"}]}
        with (
            patch("api.ai_agents._get_key", return_value="sk-ant-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://api.anthropic.com/v1/messages").mock(
                return_value=httpx.Response(200, json=anthropic_resp)
            )
            resp = await client.post(
                "/admin/ai-agents/anthropic/chat",
                headers=admin_headers,
                json={"message": "Hi Claude"},
            )
        assert resp.status_code == 200
        assert resp.json()["reply"] == "Hello from Claude"

    async def test_chat_gemini_returns_reply(self, client, admin_headers, fake_redis):
        gemini_resp = {"candidates": [{"content": {"parts": [{"text": "Gemini reply"}]}}]}
        with (
            patch("api.ai_agents._get_key", return_value="AIza-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post(url__regex=r"generativelanguage\.googleapis\.com.*generateContent").mock(
                return_value=httpx.Response(200, json=gemini_resp)
            )
            resp = await client.post(
                "/admin/ai-agents/gemini/chat",
                headers=admin_headers,
                json={"message": "Hi Gemini"},
            )
        assert resp.status_code == 200
        assert resp.json()["reply"] == "Gemini reply"

    async def test_chat_deepseek_openai_compat(self, client, admin_headers, fake_redis):
        ds_resp = {"choices": [{"message": {"content": "DeepSeek response"}}]}
        with (
            patch("api.ai_agents._get_key", return_value="sk-ds-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://api.deepseek.com/v1/chat/completions").mock(
                return_value=httpx.Response(200, json=ds_resp)
            )
            resp = await client.post(
                "/admin/ai-agents/deepseek/chat",
                headers=admin_headers,
                json={"message": "Hello DeepSeek"},
            )
        assert resp.status_code == 200
        assert resp.json()["reply"] == "DeepSeek response"

    async def test_chat_unknown_agent_returns_404(self, client, admin_headers):
        resp = await client.post(
            "/admin/ai-agents/nonexistent/chat",
            headers=admin_headers,
            json={"message": "hi"},
        )
        assert resp.status_code == 404

    async def test_chat_without_key_returns_503(self, client, admin_headers):
        with patch("api.ai_agents._get_key", return_value=None):
            resp = await client.post(
                "/admin/ai-agents/openai/chat",
                headers=admin_headers,
                json={"message": "hi"},
            )
        assert resp.status_code == 503

    async def test_chat_provider_error_returns_502(self, client, admin_headers, fake_redis):
        with (
            patch("api.ai_agents._get_key", return_value="sk-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://api.openai.com/v1/chat/completions").mock(
                return_value=httpx.Response(429, text="Rate limited")
            )
            resp = await client.post(
                "/admin/ai-agents/openai/chat",
                headers=admin_headers,
                json={"message": "hi"},
            )
        assert resp.status_code == 502

    async def test_chat_requires_auth(self, client):
        resp = await client.post("/admin/ai-agents/openai/chat", json={"message": "hi"})
        assert resp.status_code == 403

    async def test_chat_saves_to_redis_history(self, client, admin_headers, fake_redis):
        openai_resp = {"choices": [{"message": {"content": "saved reply"}}]}
        with (
            patch("api.ai_agents._get_key", return_value="sk-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://api.openai.com/v1/chat/completions").mock(
                return_value=httpx.Response(200, json=openai_resp)
            )
            resp = await client.post(
                "/admin/ai-agents/openai/chat",
                headers=admin_headers,
                json={"message": "test history"},
            )
        assert resp.status_code == 200
        raw = await fake_redis.lrange("agent_history:openai", 0, 0)
        assert len(raw) == 1
        entry = json.loads(raw[0])
        assert entry["message"] == "test history"
        assert entry["reply"] == "saved reply"
        assert "id" in entry
        assert "timestamp" in entry

    async def test_chat_history_trimmed_to_100(self, client, admin_headers, fake_redis):
        openai_resp = {"choices": [{"message": {"content": "ok"}}]}
        with (
            patch("api.ai_agents._get_key", return_value="sk-test"),
            patch("api.ai_agents.get_redis", return_value=fake_redis),
            respx.mock(assert_all_called=False) as mock,
        ):
            mock.post("https://api.openai.com/v1/chat/completions").mock(
                return_value=httpx.Response(200, json=openai_resp)
            )
            for _ in range(101):
                await client.post(
                    "/admin/ai-agents/openai/chat",
                    headers=admin_headers,
                    json={"message": "msg"},
                )
        count = await fake_redis.llen("agent_history:openai")
        assert count == 100


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/ai-agents/{id}/history
# ─────────────────────────────────────────────────────────────────────────────

class TestAgentHistory:
    async def test_empty_history_returns_empty_list(self, client, admin_headers, fake_redis):
        with patch("api.ai_agents.get_redis", return_value=fake_redis):
            resp = await client.get("/admin/ai-agents/openai/history", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_saved_entries(self, client, admin_headers, fake_redis):
        entry = {
            "id": "test-uuid-1",
            "timestamp": "2026-01-01T12:00:00+00:00",
            "message": "What is AI?",
            "reply": "AI is artificial intelligence.",
            "model": "gpt-4o",
        }
        await fake_redis.lpush("agent_history:openai", json.dumps(entry))
        with patch("api.ai_agents.get_redis", return_value=fake_redis):
            resp = await client.get("/admin/ai-agents/openai/history", headers=admin_headers)
        data = resp.json()
        assert len(data) == 1
        assert data[0]["message"] == "What is AI?"
        assert data[0]["reply"] == "AI is artificial intelligence."

    async def test_history_entry_has_all_fields(self, client, admin_headers, fake_redis):
        entry = {
            "id": "test-uuid-2",
            "timestamp": "2026-01-01T12:00:00+00:00",
            "message": "Question",
            "reply": "Answer",
            "model": "claude-sonnet-4-5",
        }
        await fake_redis.lpush("agent_history:anthropic", json.dumps(entry))
        with patch("api.ai_agents.get_redis", return_value=fake_redis):
            resp = await client.get("/admin/ai-agents/anthropic/history", headers=admin_headers)
        data = resp.json()
        assert all(k in data[0] for k in ["id", "timestamp", "message", "reply", "model"])

    async def test_unknown_agent_returns_404(self, client, admin_headers):
        resp = await client.get("/admin/ai-agents/nonexistent/history", headers=admin_headers)
        assert resp.status_code == 404

    async def test_requires_auth(self, client):
        resp = await client.get("/admin/ai-agents/openai/history")
        assert resp.status_code == 403

    async def test_respects_limit(self, client, admin_headers, fake_redis):
        for i in range(10):
            entry = {"id": f"u{i}", "timestamp": "2026-01-01T00:00:00+00:00",
                     "message": f"m{i}", "reply": f"r{i}", "model": "gpt-4o"}
            await fake_redis.lpush("agent_history:openai", json.dumps(entry))
        with patch("api.ai_agents.get_redis", return_value=fake_redis):
            resp = await client.get(
                "/admin/ai-agents/openai/history?limit=3", headers=admin_headers
            )
        assert len(resp.json()) == 3

    async def test_newest_first(self, client, admin_headers, fake_redis):
        for i in range(3):
            entry = {"id": f"u{i}", "timestamp": "2026-01-01T00:00:00+00:00",
                     "message": f"msg {i}", "reply": "r", "model": "gpt-4o"}
            await fake_redis.lpush("agent_history:openai", json.dumps(entry))
        with patch("api.ai_agents.get_redis", return_value=fake_redis):
            resp = await client.get("/admin/ai-agents/openai/history", headers=admin_headers)
        assert resp.json()[0]["message"] == "msg 2"


# ─────────────────────────────────────────────────────────────────────────────
# PUT /admin/ai-agents/{id}/key
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateKey:
    def _mock_env(self, tmp_path, content="OPENAI_API_KEY=old-key\n"):
        env_file = tmp_path / ".env"
        env_file.write_text(content)
        import builtins
        real_open = builtins.open

        def mock_open(path, mode="r", **kw):
            if "infra" in str(path) and ".env" in str(path):
                return real_open(str(env_file), mode, **kw)
            return real_open(path, mode, **kw)

        return env_file, mock_open

    async def test_returns_masked_key(self, client, admin_headers, tmp_path):
        env_file, mock_open = self._mock_env(tmp_path)
        with patch("builtins.open", side_effect=mock_open), patch("os.path.exists", return_value=True):
            resp = await client.put(
                "/admin/ai-agents/openai/key",
                headers=admin_headers,
                json={"api_key": "sk-new-key-12345"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent_id"] == "openai"
        assert "sk-new-key-12345" not in data["key_masked"]
        assert "•" in data["key_masked"]

    async def test_persists_to_env_file(self, client, admin_headers, tmp_path):
        env_file, mock_open = self._mock_env(tmp_path)
        with patch("builtins.open", side_effect=mock_open), patch("os.path.exists", return_value=True):
            await client.put(
                "/admin/ai-agents/openai/key",
                headers=admin_headers,
                json={"api_key": "sk-persisted-key"},
            )
        assert "sk-persisted-key" in env_file.read_text()

    async def test_empty_key_rejected(self, client, admin_headers):
        resp = await client.put(
            "/admin/ai-agents/openai/key",
            headers=admin_headers,
            json={"api_key": "   "},
        )
        assert resp.status_code == 422

    async def test_unknown_agent_returns_404(self, client, admin_headers):
        resp = await client.put(
            "/admin/ai-agents/unknown/key",
            headers=admin_headers,
            json={"api_key": "sk-test"},
        )
        assert resp.status_code == 404

    async def test_requires_auth(self, client):
        resp = await client.put("/admin/ai-agents/openai/key", json={"api_key": "sk-test"})
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /admin/ai-agents/{id}/key
# ─────────────────────────────────────────────────────────────────────────────

class TestDisableAgent:
    def _mock_env(self, tmp_path, content="OPENAI_API_KEY=sk-existing\n"):
        env_file = tmp_path / ".env"
        env_file.write_text(content)
        import builtins
        real_open = builtins.open

        def mock_open(path, mode="r", **kw):
            if "infra" in str(path) and ".env" in str(path):
                return real_open(str(env_file), mode, **kw)
            return real_open(path, mode, **kw)

        return env_file, mock_open

    async def test_returns_204(self, client, admin_headers, tmp_path):
        _, mock_open = self._mock_env(tmp_path)
        with patch("builtins.open", side_effect=mock_open), patch("os.path.exists", return_value=True):
            resp = await client.delete("/admin/ai-agents/openai/key", headers=admin_headers)
        assert resp.status_code == 204

    async def test_clears_key_in_env(self, client, admin_headers, tmp_path):
        env_file, mock_open = self._mock_env(tmp_path)
        with patch("builtins.open", side_effect=mock_open), patch("os.path.exists", return_value=True):
            await client.delete("/admin/ai-agents/openai/key", headers=admin_headers)
        content = env_file.read_text()
        assert "OPENAI_API_KEY=" in content
        assert "sk-existing" not in content

    async def test_unknown_agent_returns_404(self, client, admin_headers):
        resp = await client.delete("/admin/ai-agents/unknown/key", headers=admin_headers)
        assert resp.status_code == 404

    async def test_requires_auth(self, client):
        resp = await client.delete("/admin/ai-agents/openai/key")
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# _mask() helper
# ─────────────────────────────────────────────────────────────────────────────

class TestMaskHelper:
    def test_none_returns_empty(self):
        from api.ai_agents import _mask
        assert _mask(None) == ""

    def test_empty_string_returns_empty(self):
        from api.ai_agents import _mask
        assert _mask("") == ""

    def test_short_key_fully_masked(self):
        from api.ai_agents import _mask
        assert _mask("abc") == "•••"

    def test_long_key_shows_prefix_and_suffix(self):
        from api.ai_agents import _mask
        key = "sk-" + "a" * 20 + "XXXX"
        result = _mask(key)
        assert result.startswith(key[:6])
        assert result.endswith(key[-4:])
        assert "•" in result

    def test_original_key_not_in_output(self):
        from api.ai_agents import _mask
        key = "sk-super-secret-api-key-9999"
        assert key not in _mask(key)

    def test_mask_preserves_length(self):
        from api.ai_agents import _mask
        key = "sk-" + "x" * 20
        assert len(_mask(key)) == len(key)

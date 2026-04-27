"""
Tests for api/whatsapp.py routes:
  POST /whatsapp/webhook  — public, receives Evolution API events
  GET  /whatsapp/config   — admin-only, returns Evolution config
"""
import pytest


# ---------------------------------------------------------------------------
# Webhook — POST /whatsapp/webhook
# ---------------------------------------------------------------------------

class TestWhatsAppWebhook:
    async def test_unknown_event_returns_ok(self, client):
        resp = await client.post(
            "/whatsapp/webhook",
            json={"event": "some.unknown.event", "data": {}},
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    async def test_incoming_message_returns_ok(self, client):
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"fromMe": False, "remoteJid": "972501234567@s.whatsapp.net"},
                "message": {"conversation": "שלום"},
            },
        }
        resp = await client.post("/whatsapp/webhook", json=payload)
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    async def test_own_message_skipped(self, client):
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"fromMe": True, "remoteJid": "972501234567@s.whatsapp.net"},
                "message": {"conversation": "sent by us"},
            },
        }
        resp = await client.post("/whatsapp/webhook", json=payload)
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    async def test_group_message_returns_ok(self, client):
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"fromMe": False, "remoteJid": "120363000000@g.us"},
                "message": {"conversation": "group message"},
            },
        }
        resp = await client.post("/whatsapp/webhook", json=payload)
        assert resp.status_code == 200

    async def test_extended_text_message_returns_ok(self, client):
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"fromMe": False, "remoteJid": "972501234567@s.whatsapp.net"},
                "message": {
                    "extendedTextMessage": {"text": "הודעה עם מידע נוסף"}
                },
            },
        }
        resp = await client.post("/whatsapp/webhook", json=payload)
        assert resp.status_code == 200

    async def test_connection_update_returns_ok(self, client):
        payload = {
            "event": "connection.update",
            "data": {"state": "open"},
        }
        resp = await client.post("/whatsapp/webhook", json=payload)
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    async def test_invalid_json_returns_ok(self, client):
        resp = await client.post(
            "/whatsapp/webhook",
            content=b"not-json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    async def test_empty_payload_returns_ok(self, client):
        resp = await client.post("/whatsapp/webhook", json={})
        assert resp.status_code == 200

    async def test_missing_message_field_returns_ok(self, client):
        """message field absent — should not crash."""
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"fromMe": False, "remoteJid": "972501234567@s.whatsapp.net"},
            },
        }
        resp = await client.post("/whatsapp/webhook", json=payload)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Config — GET /whatsapp/config  (admin-only)
# ---------------------------------------------------------------------------

class TestWhatsAppConfig:
    async def test_requires_authentication(self, client):
        resp = await client.get("/whatsapp/config")
        assert resp.status_code in (401, 403)

    async def test_requires_admin_role(self, client, passenger_headers):
        resp = await client.get("/whatsapp/config", headers=passenger_headers)
        assert resp.status_code == 403

    async def test_admin_returns_config(self, client, admin_headers):
        resp = await client.get("/whatsapp/config", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "evolution_url" in data
        assert "instance" in data
        assert "api_key" in data
        assert data["instance"] == "test-instance"
        assert data["api_key"] == "test-evo-key"

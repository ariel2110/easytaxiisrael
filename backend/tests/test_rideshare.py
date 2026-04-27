"""
Tests for rideshare (non-licensed taxi) driver flow.

Covers:
  - GET /rideshare/info (public — law status + FAQ)
  - GET /rideshare/checklist (public)
  - POST /rideshare/register (driver declares non-licensed)
  - POST /rideshare/acknowledge (no-payment confirmation)
  - GET  /rideshare/profile
  - POST /rideshare/documents (upload)
  - GET  /rideshare/documents (list)
  - POST /rideshare/admin/documents/{id}/review (admin approve/reject)
  - GET  /rideshare/admin/{driver_id}/profile
  - GET  /rideshare/admin/drivers
  - Role enforcement (passenger / unauthenticated blocked)
  - Business rules (must register before acknowledge, must acknowledge before upload, etc.)
"""

import uuid

import pytest

from models.rideshare import RideshareStatus
from models.user import DriverType


# ─────────────────────────────────────────────────────────────────────────────
# Public endpoints
# ─────────────────────────────────────────────────────────────────────────────

class TestPublicInfo:
    @pytest.mark.asyncio
    async def test_info_returns_legislation_and_faq(self, client):
        resp = await client.get("/rideshare/info")
        assert resp.status_code == 200
        data = resp.json()
        assert "legislation" in data
        assert "faq" in data
        assert len(data["faq"]) >= 5

    @pytest.mark.asyncio
    async def test_info_has_no_payment_explanation(self, client):
        resp = await client.get("/rideshare/info")
        assert "why_no_payment_yet" in resp.json()["legislation"]

    @pytest.mark.asyncio
    async def test_info_has_official_links(self, client):
        resp = await client.get("/rideshare/info")
        links = resp.json()["legislation"]["official_links"]
        assert len(links) >= 2
        for link in links:
            assert "url" in link
            assert "title" in link

    @pytest.mark.asyncio
    async def test_info_no_auth_required(self, client):
        resp = await client.get("/rideshare/info")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_checklist_returns_required_docs(self, client):
        resp = await client.get("/rideshare/checklist")
        assert resp.status_code == 200
        items = resp.json()
        ids = [i["id"] for i in items]
        for doc_id in [
            "drivers_license", "identity_document", "background_check",
            "insurance_mandatory", "vehicle_inspection", "profile_photo",
        ]:
            assert doc_id in ids, f"Missing required doc: {doc_id}"

    @pytest.mark.asyncio
    async def test_checklist_has_how_to_apply(self, client):
        resp = await client.get("/rideshare/checklist")
        items = resp.json()
        for item in items:
            assert "why" in item
            assert "accepted_formats" in item


# ─────────────────────────────────────────────────────────────────────────────
# Registration — POST /rideshare/register
# ─────────────────────────────────────────────────────────────────────────────

class TestRegister:
    @pytest.mark.asyncio
    async def test_driver_can_register_as_rideshare(self, client, driver_headers):
        resp = await client.post("/rideshare/register", headers=driver_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["driver_type"] == DriverType.rideshare.value
        assert data["profile"]["status"] == RideshareStatus.pending_legislation.value
        assert data["profile"]["acknowledged_no_payment"] is False

    @pytest.mark.asyncio
    async def test_register_idempotent(self, client, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        resp = await client.post("/rideshare/register", headers=driver_headers)
        assert resp.status_code == 200  # second call succeeds

    @pytest.mark.asyncio
    async def test_passenger_cannot_register(self, client, passenger_headers):
        resp = await client.post("/rideshare/register", headers=passenger_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_register(self, client):
        resp = await client.post("/rideshare/register")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_register_message_mentions_no_payment(self, client, driver_headers):
        resp = await client.post("/rideshare/register", headers=driver_headers)
        assert "תשלום" in resp.json()["message"]


# ─────────────────────────────────────────────────────────────────────────────
# Acknowledge no-payment — POST /rideshare/acknowledge
# ─────────────────────────────────────────────────────────────────────────────

class TestAcknowledge:
    @pytest.mark.asyncio
    async def test_driver_must_register_before_acknowledge(self, client, driver_headers, db, driver):
        """A fresh driver who hasn't registered as rideshare gets 400."""
        # Make sure driver_type is not rideshare
        assert driver.driver_type != DriverType.rideshare
        resp = await client.post("/rideshare/acknowledge", headers=driver_headers)
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_driver_can_acknowledge_after_register(self, client, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        resp = await client.post("/rideshare/acknowledge", headers=driver_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["acknowledged_no_payment"] is True
        assert data["status"] == RideshareStatus.documents_pending.value

    @pytest.mark.asyncio
    async def test_acknowledge_idempotent(self, client, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        await client.post("/rideshare/acknowledge", headers=driver_headers)
        resp = await client.post("/rideshare/acknowledge", headers=driver_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_passenger_cannot_acknowledge(self, client, passenger_headers):
        resp = await client.post("/rideshare/acknowledge", headers=passenger_headers)
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Profile — GET /rideshare/profile
# ─────────────────────────────────────────────────────────────────────────────

class TestProfile:
    @pytest.mark.asyncio
    async def test_driver_can_view_profile(self, client, driver_headers):
        resp = await client.get("/rideshare/profile", headers=driver_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "acknowledged_no_payment" in data

    @pytest.mark.asyncio
    async def test_profile_defaults_pending(self, client, driver_headers):
        resp = await client.get("/rideshare/profile", headers=driver_headers)
        assert resp.json()["status"] == RideshareStatus.pending_legislation.value

    @pytest.mark.asyncio
    async def test_passenger_cannot_view_profile(self, client, passenger_headers):
        resp = await client.get("/rideshare/profile", headers=passenger_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_view_profile(self, client):
        resp = await client.get("/rideshare/profile")
        assert resp.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Document upload / list
# ─────────────────────────────────────────────────────────────────────────────

class TestDocumentUpload:
    @pytest.mark.asyncio
    async def test_must_acknowledge_before_uploading(self, client, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        resp = await client.post(
            "/rideshare/documents",
            json={"doc_type": "drivers_license", "file_key": "files/dl.pdf"},
            headers=driver_headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_can_upload_after_acknowledge(self, client, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        await client.post("/rideshare/acknowledge", headers=driver_headers)
        resp = await client.post(
            "/rideshare/documents",
            json={"doc_type": "drivers_license", "file_key": "files/dl.pdf"},
            headers=driver_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["doc_type"] == "drivers_license"
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_upload_replaces_existing_same_type(self, client, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        await client.post("/rideshare/acknowledge", headers=driver_headers)
        await client.post(
            "/rideshare/documents",
            json={"doc_type": "profile_photo", "file_key": "old.jpg"},
            headers=driver_headers,
        )
        await client.post(
            "/rideshare/documents",
            json={"doc_type": "profile_photo", "file_key": "new.jpg"},
            headers=driver_headers,
        )
        resp = await client.get("/rideshare/documents", headers=driver_headers)
        photos = [d for d in resp.json() if d["doc_type"] == "profile_photo"]
        assert len(photos) == 1
        assert photos[0]["file_key"] == "new.jpg"

    @pytest.mark.asyncio
    async def test_status_becomes_documents_submitted_after_upload(self, client, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        await client.post("/rideshare/acknowledge", headers=driver_headers)
        await client.post(
            "/rideshare/documents",
            json={"doc_type": "identity_document", "file_key": "files/id.pdf"},
            headers=driver_headers,
        )
        resp = await client.get("/rideshare/profile", headers=driver_headers)
        assert resp.json()["status"] == RideshareStatus.documents_submitted.value

    @pytest.mark.asyncio
    async def test_must_register_as_rideshare_to_upload(self, client, driver_headers):
        """Driver who hasn't registered as rideshare gets 400."""
        resp = await client.post(
            "/rideshare/documents",
            json={"doc_type": "drivers_license", "file_key": "files/dl.pdf"},
            headers=driver_headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_passenger_cannot_upload(self, client, passenger_headers):
        resp = await client.post(
            "/rideshare/documents",
            json={"doc_type": "drivers_license", "file_key": "files/dl.pdf"},
            headers=passenger_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_list_documents(self, client, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        await client.post("/rideshare/acknowledge", headers=driver_headers)
        await client.post(
            "/rideshare/documents",
            json={"doc_type": "background_check", "file_key": "files/bg.pdf"},
            headers=driver_headers,
        )
        resp = await client.get("/rideshare/documents", headers=driver_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# ─────────────────────────────────────────────────────────────────────────────
# Admin routes
# ─────────────────────────────────────────────────────────────────────────────

class TestAdminRideshare:
    @pytest.mark.asyncio
    async def test_admin_can_view_driver_profile(self, client, admin_headers, driver):
        resp = await client.get(
            f"/rideshare/admin/{driver.id}/profile", headers=admin_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_can_list_rideshare_drivers(self, client, admin_headers):
        resp = await client.get("/rideshare/admin/drivers", headers=admin_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_admin_approve_document(self, client, admin_headers, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        await client.post("/rideshare/acknowledge", headers=driver_headers)
        upload = await client.post(
            "/rideshare/documents",
            json={"doc_type": "vehicle_inspection", "file_key": "files/test.pdf"},
            headers=driver_headers,
        )
        doc_id = upload.json()["id"]
        resp = await client.post(
            f"/rideshare/admin/documents/{doc_id}/review",
            json={"approved": True},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    @pytest.mark.asyncio
    async def test_admin_reject_requires_reason(self, client, admin_headers, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        await client.post("/rideshare/acknowledge", headers=driver_headers)
        upload = await client.post(
            "/rideshare/documents",
            json={"doc_type": "vehicle_registration", "file_key": "files/reg.pdf"},
            headers=driver_headers,
        )
        doc_id = upload.json()["id"]
        resp = await client.post(
            f"/rideshare/admin/documents/{doc_id}/review",
            json={"approved": False},
            headers=admin_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_admin_reject_with_reason(self, client, admin_headers, driver_headers):
        await client.post("/rideshare/register", headers=driver_headers)
        await client.post("/rideshare/acknowledge", headers=driver_headers)
        upload = await client.post(
            "/rideshare/documents",
            json={"doc_type": "insurance_mandatory", "file_key": "files/ins.pdf"},
            headers=driver_headers,
        )
        doc_id = upload.json()["id"]
        resp = await client.post(
            f"/rideshare/admin/documents/{doc_id}/review",
            json={"approved": False, "rejection_reason": "מסמך פג תוקף"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert data["rejection_reason"] == "מסמך פג תוקף"

    @pytest.mark.asyncio
    async def test_driver_cannot_access_admin_routes(self, client, driver_headers, driver):
        resp = await client.get(
            f"/rideshare/admin/{driver.id}/profile", headers=driver_headers
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_passenger_cannot_access_admin_routes(self, client, passenger_headers, driver):
        resp = await client.get(
            f"/rideshare/admin/{driver.id}/profile", headers=passenger_headers
        )
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Service unit tests
# ─────────────────────────────────────────────────────────────────────────────

class TestRideshareService:
    @pytest.mark.asyncio
    async def test_required_docs_include_all_critical(self):
        from services.rideshare import REQUIRED_DOCUMENTS
        required_ids = {r["id"].value for r in REQUIRED_DOCUMENTS if r["required"]}
        for doc_id in [
            "drivers_license", "identity_document", "background_check",
            "insurance_mandatory", "vehicle_inspection",
        ]:
            assert doc_id in required_ids

    @pytest.mark.asyncio
    async def test_faq_has_no_payment_question(self):
        from services.rideshare import RIDESHARE_FAQ
        texts = " ".join(q["a"] for q in RIDESHARE_FAQ)
        assert "תשלום" in texts

    @pytest.mark.asyncio
    async def test_legislation_status_has_stage(self):
        from services.rideshare import LEGISLATION_STATUS
        assert "current_stage" in LEGISLATION_STATUS
        assert "2026" in LEGISLATION_STATUS["current_stage"]

    @pytest.mark.asyncio
    async def test_ready_status_set_when_all_required_docs_approved(self, db, driver):
        from services.rideshare import (
            REQUIRED_DOCUMENTS,
            acknowledge_no_payment,
            get_or_create_profile,
            register_as_rideshare,
            review_document,
            upload_document,
        )
        from models.rideshare import RideshareDocType
        from models.user import DriverType

        await register_as_rideshare(db, driver)
        await db.refresh(driver)
        await acknowledge_no_payment(db, driver.id, "127.0.0.1")

        required_types = [r["id"] for r in REQUIRED_DOCUMENTS if r["required"]]
        # Upload and approve all required docs
        for doc_type in required_types:
            doc = await upload_document(db, driver.id, doc_type, f"files/{doc_type.value}.pdf")
            await review_document(db, doc.id, True, driver.id)

        profile = await get_or_create_profile(db, driver.id)
        assert profile.status == RideshareStatus.ready

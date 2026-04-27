"""
Tests for vehicle compliance integration.

Covers:
  - GET  /vehicle/checklist  (public)
  - POST /vehicle/photos (driver upload)
  - GET  /vehicle/photos (driver list)
  - GET  /vehicle/compliance (driver)
  - POST /vehicle/inquiry (driver → Persona vehicle template)
  - GET  /vehicle/inquiry/status (driver)
  - POST /vehicle/admin/photos/{id}/review (admin approve/reject)
  - PATCH /vehicle/admin/{driver_id}/documents (admin update flags)
  - GET  /vehicle/admin/{driver_id}/compliance (admin view)
  - Persona webhook → vehicle template routing (unit)
  - Role enforcement (passenger / unauthenticated blocked)
"""

import hashlib
import hmac
import json
import time
import uuid
from unittest.mock import patch

import pytest
import respx
import httpx

from models.persona import PersonaInquiry, PersonaInquiryStatus
from models.vehicle import (
    VehicleCompliance,
    VehicleComplianceStatus,
    VehiclePhoto,
    VehiclePhotoStatus,
    VehiclePhotoType,
)
from services.vehicle import (
    REQUIRED_PHOTO_TYPES,
    VEHICLE_CHECKLIST,
    get_or_create_compliance,
    handle_vehicle_inquiry_approved,
    handle_vehicle_inquiry_declined,
    upload_photo,
)

FAKE_VEHICLE_TEMPLATE_ID = "itmpl_ACtCnpSYUfM5hTMSUV5UYzeYfVZZUx"
FAKE_INQUIRY_ID = "inq_vehicle_test_001"
FAKE_SESSION_TOKEN = "sess_vehicle_test_token"


def _vehicle_config_patch():
    return patch.multiple(
        "core.config.settings",
        PERSONA_API_KEY="persona_sandbox_test_key",
        PERSONA_VEHICLE_TEMPLATE_ID=FAKE_VEHICLE_TEMPLATE_ID,
        PERSONA_API_VERSION="2025-12-08",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Checklist (public)
# ─────────────────────────────────────────────────────────────────────────────

class TestChecklist:
    @pytest.mark.asyncio
    async def test_checklist_returns_11_items(self, client):
        resp = await client.get("/vehicle/checklist")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 11  # 5 doc checks + 6 photos

    @pytest.mark.asyncio
    async def test_checklist_has_required_fields(self, client):
        resp = await client.get("/vehicle/checklist")
        assert resp.status_code == 200
        for item in resp.json():
            assert "id" in item
            assert "name_he" in item
            assert "required" in item

    @pytest.mark.asyncio
    async def test_checklist_no_auth_required(self, client):
        """Public endpoint — no token needed."""
        resp = await client.get("/vehicle/checklist")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_checklist_includes_mandatory_insurance(self, client):
        resp = await client.get("/vehicle/checklist")
        ids = [item["id"] for item in resp.json()]
        assert "insurance_mandatory" in ids

    @pytest.mark.asyncio
    async def test_checklist_includes_all_photo_types(self, client):
        resp = await client.get("/vehicle/checklist")
        ids = [item["id"] for item in resp.json()]
        for photo_id in [
            "photo_front", "photo_rear", "photo_driver_side",
            "photo_passenger_side", "photo_interior_front", "photo_interior_rear",
        ]:
            assert photo_id in ids, f"Missing {photo_id}"


# ─────────────────────────────────────────────────────────────────────────────
# Photo upload + listing
# ─────────────────────────────────────────────────────────────────────────────

class TestVehiclePhotos:
    @pytest.mark.asyncio
    async def test_driver_can_upload_photo(self, client, driver_headers):
        resp = await client.post(
            "/vehicle/photos",
            json={"photo_type": "front", "file_key": "uploads/driver/front.jpg"},
            headers=driver_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["photo_type"] == "front"
        assert data["status"] == "pending"
        assert data["file_key"] == "uploads/driver/front.jpg"

    @pytest.mark.asyncio
    async def test_driver_can_upload_all_six_types(self, client, driver_headers):
        types = [t.value for t in REQUIRED_PHOTO_TYPES]
        for pt in types:
            resp = await client.post(
                "/vehicle/photos",
                json={"photo_type": pt, "file_key": f"uploads/{pt}.jpg"},
                headers=driver_headers,
            )
            assert resp.status_code == 201, f"Failed for {pt}: {resp.text}"

    @pytest.mark.asyncio
    async def test_driver_can_list_photos(self, client, driver_headers):
        # Upload one first
        await client.post(
            "/vehicle/photos",
            json={"photo_type": "rear", "file_key": "uploads/rear.jpg"},
            headers=driver_headers,
        )
        resp = await client.get("/vehicle/photos", headers=driver_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_replace_existing_photo(self, client, driver_headers):
        """Uploading the same type again replaces the previous one."""
        await client.post(
            "/vehicle/photos",
            json={"photo_type": "driver_side", "file_key": "old.jpg"},
            headers=driver_headers,
        )
        await client.post(
            "/vehicle/photos",
            json={"photo_type": "driver_side", "file_key": "new.jpg"},
            headers=driver_headers,
        )
        resp = await client.get("/vehicle/photos", headers=driver_headers)
        ds_photos = [p for p in resp.json() if p["photo_type"] == "driver_side"]
        assert len(ds_photos) == 1
        assert ds_photos[0]["file_key"] == "new.jpg"

    @pytest.mark.asyncio
    async def test_passenger_cannot_upload_photo(self, client, passenger_headers):
        resp = await client.post(
            "/vehicle/photos",
            json={"photo_type": "front", "file_key": "test.jpg"},
            headers=passenger_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_list_photos(self, client):
        resp = await client.get("/vehicle/photos")
        assert resp.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Compliance status
# ─────────────────────────────────────────────────────────────────────────────

class TestVehicleCompliance:
    @pytest.mark.asyncio
    async def test_driver_gets_compliance_status(self, client, driver_headers):
        resp = await client.get("/vehicle/compliance", headers=driver_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data["insurance_mandatory_valid"] is False
        assert data["photos_complete"] is False

    @pytest.mark.asyncio
    async def test_passenger_cannot_view_compliance(self, client, passenger_headers):
        resp = await client.get("/vehicle/compliance", headers=passenger_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_view_compliance(self, client):
        resp = await client.get("/vehicle/compliance")
        assert resp.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Persona vehicle inquiry
# ─────────────────────────────────────────────────────────────────────────────

class TestVehicleInquiry:
    @pytest.mark.asyncio
    async def test_driver_can_start_vehicle_inquiry(self, client, driver_headers):
        inq_id = f"inq_vehicle_{uuid.uuid4().hex[:8]}"
        persona_resp = {
            "data": {
                "id": inq_id,
                "attributes": {"session-token": FAKE_SESSION_TOKEN},
            }
        }
        with _vehicle_config_patch():
            with respx.mock:
                respx.post("https://withpersona.com/api/v1/inquiries").mock(
                    return_value=httpx.Response(201, json=persona_resp)
                )
                resp = await client.post("/vehicle/inquiry", headers=driver_headers)

        assert resp.status_code == 201
        data = resp.json()
        assert data["persona_inquiry_id"] == inq_id
        assert FAKE_SESSION_TOKEN in data["hosted_flow_url"]

    @pytest.mark.asyncio
    async def test_vehicle_inquiry_idempotent(self, client, driver_headers, db):
        """Second call to /vehicle/inquiry returns the existing active inquiry."""
        inq_id = f"inq_idem_{uuid.uuid4().hex[:8]}"
        persona_resp = {
            "data": {
                "id": inq_id,
                "attributes": {"session-token": FAKE_SESSION_TOKEN},
            }
        }
        with _vehicle_config_patch():
            with respx.mock:
                route = respx.post("https://withpersona.com/api/v1/inquiries").mock(
                    return_value=httpx.Response(201, json=persona_resp)
                )
                await client.post("/vehicle/inquiry", headers=driver_headers)
                # Second call — should NOT hit the API again
                resp = await client.post("/vehicle/inquiry", headers=driver_headers)
                assert route.call_count == 1  # still only 1 API call

        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_vehicle_inquiry_status_none_before_creation(self, client, driver_headers):
        resp = await client.get("/vehicle/inquiry/status", headers=driver_headers)
        assert resp.status_code == 200
        # Returns null / None when no inquiry exists
        assert resp.json() is None

    @pytest.mark.asyncio
    async def test_vehicle_inquiry_status_after_creation(self, client, driver_headers):
        inq_id = f"inq_status_{uuid.uuid4().hex[:8]}"
        persona_resp = {
            "data": {
                "id": inq_id,
                "attributes": {"session-token": FAKE_SESSION_TOKEN},
            }
        }
        with _vehicle_config_patch():
            with respx.mock:
                respx.post("https://withpersona.com/api/v1/inquiries").mock(
                    return_value=httpx.Response(201, json=persona_resp)
                )
                await client.post("/vehicle/inquiry", headers=driver_headers)

        with _vehicle_config_patch():
            resp = await client.get("/vehicle/inquiry/status", headers=driver_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None
        assert data["persona_inquiry_id"] == inq_id

    @pytest.mark.asyncio
    async def test_passenger_cannot_start_vehicle_inquiry(self, client, passenger_headers):
        resp = await client.post("/vehicle/inquiry", headers=passenger_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unconfigured_returns_503(self, client, driver_headers):
        with patch("core.config.settings.PERSONA_API_KEY", ""), \
             patch("core.config.settings.PERSONA_VEHICLE_TEMPLATE_ID", ""):
            resp = await client.post("/vehicle/inquiry", headers=driver_headers)
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_persona_api_failure_returns_502(self, client, driver_headers):
        with _vehicle_config_patch():
            with respx.mock:
                respx.post("https://withpersona.com/api/v1/inquiries").mock(
                    return_value=httpx.Response(500, json={"error": "internal"})
                )
                resp = await client.post("/vehicle/inquiry", headers=driver_headers)
        assert resp.status_code == 502


# ─────────────────────────────────────────────────────────────────────────────
# Admin routes
# ─────────────────────────────────────────────────────────────────────────────

class TestAdminVehicle:
    @pytest.mark.asyncio
    async def test_admin_can_view_driver_compliance(self, client, admin_headers, driver):
        resp = await client.get(
            f"/vehicle/admin/{driver.id}/compliance", headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_admin_can_update_document_flags(self, client, admin_headers, driver):
        resp = await client.patch(
            f"/vehicle/admin/{driver.id}/documents",
            json={
                "insurance_mandatory": True,
                "insurance_commercial": True,
                "vehicle_test": True,
                "registration": True,
                "vehicle_age_ok": True,
            },
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["insurance_mandatory_valid"] is True
        assert data["vehicle_test_valid"] is True
        # photos_complete still False → status stays pending
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_admin_approve_photo(self, client, admin_headers, driver, driver_headers):
        # Upload a photo first
        upload = await client.post(
            "/vehicle/photos",
            json={"photo_type": "front", "file_key": "uploads/front.jpg"},
            headers=driver_headers,
        )
        photo_id = upload.json()["id"]

        resp = await client.post(
            f"/vehicle/admin/photos/{photo_id}/review",
            json={"approved": True},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    @pytest.mark.asyncio
    async def test_admin_reject_photo_requires_reason(self, client, admin_headers, driver_headers):
        upload = await client.post(
            "/vehicle/photos",
            json={"photo_type": "rear", "file_key": "uploads/rear.jpg"},
            headers=driver_headers,
        )
        photo_id = upload.json()["id"]

        resp = await client.post(
            f"/vehicle/admin/photos/{photo_id}/review",
            json={"approved": False},
            headers=admin_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_admin_reject_photo_with_reason(self, client, admin_headers, driver_headers):
        upload = await client.post(
            "/vehicle/photos",
            json={"photo_type": "passenger_side", "file_key": "uploads/ps.jpg"},
            headers=driver_headers,
        )
        photo_id = upload.json()["id"]

        resp = await client.post(
            f"/vehicle/admin/photos/{photo_id}/review",
            json={"approved": False, "rejection_reason": "Photo is blurry"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert data["rejection_reason"] == "Photo is blurry"

    @pytest.mark.asyncio
    async def test_driver_cannot_use_admin_routes(self, client, driver_headers, driver):
        resp = await client.get(
            f"/vehicle/admin/{driver.id}/compliance", headers=driver_headers
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_driver_cannot_review_photos(self, client, driver_headers):
        fake_id = uuid.uuid4()
        resp = await client.post(
            f"/vehicle/admin/photos/{fake_id}/review",
            json={"approved": True},
            headers=driver_headers,
        )
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Service unit tests — compliance evaluation
# ─────────────────────────────────────────────────────────────────────────────

class TestComplianceEvaluation:
    @pytest.mark.asyncio
    async def test_all_flags_approved_sets_status_approved(self, db, driver):
        from services.vehicle import update_document_flags

        # Approve all doc flags
        compliance = await update_document_flags(
            db,
            driver.id,
            insurance_mandatory=True,
            insurance_commercial=True,
            vehicle_test=True,
            registration=True,
            vehicle_age_ok=True,
        )
        # photos_complete is still False → pending
        assert compliance.status == VehicleComplianceStatus.pending

        # Now mark photos_complete manually
        compliance.photos_complete = True
        from services.vehicle import _recalculate_status
        _recalculate_status(compliance)
        assert compliance.status == VehicleComplianceStatus.approved

    @pytest.mark.asyncio
    async def test_handle_vehicle_inquiry_approved_sets_all_flags(self, db, driver):
        await handle_vehicle_inquiry_approved(db, driver.id, "inq_test_approved")
        compliance = await get_or_create_compliance(db, driver.id)
        assert compliance.insurance_mandatory_valid is True
        assert compliance.insurance_commercial_valid is True
        assert compliance.vehicle_test_valid is True
        assert compliance.registration_valid is True
        assert compliance.vehicle_age_ok is True
        assert compliance.persona_inquiry_id == "inq_test_approved"

    @pytest.mark.asyncio
    async def test_handle_vehicle_inquiry_declined_sets_rejected(self, db, driver):
        await handle_vehicle_inquiry_declined(db, driver.id, "inq_test_declined")
        compliance = await get_or_create_compliance(db, driver.id)
        assert compliance.status == VehicleComplianceStatus.rejected
        assert compliance.rejection_notes is not None

    @pytest.mark.asyncio
    async def test_required_photo_types_are_six(self):
        assert len(REQUIRED_PHOTO_TYPES) == 6

    @pytest.mark.asyncio
    async def test_checklist_has_11_entries(self):
        assert len(VEHICLE_CHECKLIST) == 11


# ─────────────────────────────────────────────────────────────────────────────
# Persona webhook routing — vehicle template
# ─────────────────────────────────────────────────────────────────────────────

class TestPersonaWebhookVehicleRouting:
    """
    Verify that persona.handle_webhook_event dispatches correctly
    when the inquiry belongs to the vehicle template.
    """

    @pytest.mark.asyncio
    async def test_webhook_routes_approval_to_vehicle_handler(self, db, driver):
        from sqlalchemy import select
        from models.persona import PersonaInquiry, PersonaInquiryStatus

        # Seed a vehicle inquiry
        inq = PersonaInquiry(
            driver_id=driver.id,
            persona_inquiry_id="inq_v_wh_001",
            status=PersonaInquiryStatus.completed,
            template_id=FAKE_VEHICLE_TEMPLATE_ID,
        )
        db.add(inq)
        await db.commit()

        with patch("core.config.settings.PERSONA_VEHICLE_TEMPLATE_ID", FAKE_VEHICLE_TEMPLATE_ID):
            from services.persona import handle_webhook_event
            await handle_webhook_event(db, "inquiry.approved", "inq_v_wh_001")

        compliance = await get_or_create_compliance(db, driver.id)
        assert compliance.insurance_mandatory_valid is True

    @pytest.mark.asyncio
    async def test_webhook_routes_decline_to_vehicle_handler(self, db, driver):
        from models.persona import PersonaInquiry, PersonaInquiryStatus

        inq = PersonaInquiry(
            driver_id=driver.id,
            persona_inquiry_id="inq_v_wh_002",
            status=PersonaInquiryStatus.completed,
            template_id=FAKE_VEHICLE_TEMPLATE_ID,
        )
        db.add(inq)
        await db.commit()

        with patch("core.config.settings.PERSONA_VEHICLE_TEMPLATE_ID", FAKE_VEHICLE_TEMPLATE_ID):
            from services.persona import handle_webhook_event
            await handle_webhook_event(db, "inquiry.declined", "inq_v_wh_002")

        compliance = await get_or_create_compliance(db, driver.id)
        assert compliance.status == VehicleComplianceStatus.rejected

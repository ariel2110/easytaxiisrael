"""
Integration tests for the full ride lifecycle via the API.

State machine covered:
  pending → (auto-assign) → assigned → accepted → in_progress → completed
  pending → cancelled (passenger)
  assigned → cancelled (passenger)
  assigned → cancelled (driver reject)

All WhatsApp and push notification calls are mocked so no real HTTP traffic.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio

from models.ride import Ride, RideStatus
from models.user import User, UserRole
from tests.conftest import make_user

# Patch target: all WhatsApp + push calls in services
WA_PATCH = "services.whatsapp.send_text"
PUSH_PATCH = "services.push.send_event"


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _ride_payload(
    pickup_lat: float = 32.08,
    pickup_lng: float = 34.78,
    dropoff_lat: float = 32.10,
    dropoff_lng: float = 34.80,
):
    return {
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "dropoff_lat": dropoff_lat,
        "dropoff_lng": dropoff_lng,
        "pickup_address": "תל אביב, רחוב דיזנגוף 1",
        "dropoff_address": "תל אביב, רחוב אלנבי 100",
    }


@pytest_asyncio.fixture
async def driver_headers(fake_redis, db):
    driver = await make_user(db, "972502300001", UserRole.driver, accepted_tos=False)
    from core.security import create_access_token
    token = create_access_token(str(driver.id), "driver")
    return {"Authorization": f"Bearer {token}"}, driver


@pytest_asyncio.fixture
async def fresh_passenger(db):
    return await make_user(db, f"97250{uuid.uuid4().int % 10000000:07d}", UserRole.passenger)


@pytest_asyncio.fixture
async def fresh_passenger_headers(fake_redis, fresh_passenger):
    from core.security import create_access_token
    token = create_access_token(str(fresh_passenger.id), "passenger")
    return {"Authorization": f"Bearer {token}"}, fresh_passenger


# ---------------------------------------------------------------------------
# POST /rides — request a ride
# ---------------------------------------------------------------------------

class TestRequestRide:
    async def test_passenger_can_request_ride(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post("/rides", json=_ride_payload(), headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] in ("pending", "assigned")
        assert "id" in data

    async def test_driver_cannot_request_ride(self, client, driver_headers):
        headers, _ = driver_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post("/rides", json=_ride_payload(), headers=headers)
        assert resp.status_code == 403

    async def test_unauthenticated_cannot_request_ride(self, client):
        resp = await client.post("/rides", json=_ride_payload())
        assert resp.status_code in (401, 403)

    async def test_same_pickup_dropoff_rejected(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        payload = _ride_payload(pickup_lat=32.08, pickup_lng=34.78,
                                dropoff_lat=32.08, dropoff_lng=34.78)
        resp = await client.post("/rides", json=payload, headers=headers)
        assert resp.status_code == 422

    async def test_passenger_without_tos_rejected(self, client, db):
        user = await make_user(db, "972509100100", UserRole.passenger, accepted_tos=False)
        from core.security import create_access_token
        token = create_access_token(str(user.id), "passenger")
        headers = {"Authorization": f"Bearer {token}"}
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post("/rides", json=_ride_payload(), headers=headers)
        assert resp.status_code == 403

    async def test_out_of_range_coordinates_rejected(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        payload = _ride_payload(pickup_lat=200.0)  # invalid latitude
        resp = await client.post("/rides", json=payload, headers=headers)
        assert resp.status_code == 422

    async def test_ride_response_has_required_fields(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post("/rides", json=_ride_payload(), headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        for field in ("id", "passenger_id", "status", "pickup_lat", "pickup_lng",
                      "dropoff_lat", "dropoff_lng", "created_at"):
            assert field in data, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# GET /rides — list rides
# ---------------------------------------------------------------------------

class TestListRides:
    async def test_passenger_sees_own_rides(self, client, fresh_passenger_headers):
        headers, passenger = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            await client.post("/rides", json=_ride_payload(), headers=headers)
        resp = await client.get("/rides", headers=headers)
        assert resp.status_code == 200
        rides = resp.json()
        assert all(r["passenger_id"] == str(passenger.id) for r in rides)

    async def test_unauthenticated_cannot_list(self, client):
        resp = await client.get("/rides")
        assert resp.status_code in (401, 403)

    async def test_empty_list_for_new_passenger(self, client, db):
        user = await make_user(db, "972509200001", UserRole.passenger)
        from core.security import create_access_token
        token = create_access_token(str(user.id), "passenger")
        resp = await client.get("/rides", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# GET /rides/{id}
# ---------------------------------------------------------------------------

class TestGetRide:
    async def test_get_existing_ride(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            create_resp = await client.post("/rides", json=_ride_payload(), headers=headers)
        ride_id = create_resp.json()["id"]
        resp = await client.get(f"/rides/{ride_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == ride_id

    async def test_get_nonexistent_ride_returns_404(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        resp = await client.get(f"/rides/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /rides/{id}/cancel — passenger cancels
# ---------------------------------------------------------------------------

class TestCancelRide:
    async def test_passenger_can_cancel_pending_ride(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            create_resp = await client.post("/rides", json=_ride_payload(), headers=headers)
            ride_id = create_resp.json()["id"]
            resp = await client.post(f"/rides/{ride_id}/cancel", json={}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    async def test_cancel_with_reason(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            create_resp = await client.post("/rides", json=_ride_payload(), headers=headers)
            ride_id = create_resp.json()["id"]
            resp = await client.post(
                f"/rides/{ride_id}/cancel",
                json={"reason": "Changed my mind"},
                headers=headers,
            )
        assert resp.status_code == 200
        assert resp.json()["cancellation_reason"] == "Changed my mind"

    async def test_cancel_nonexistent_ride_returns_404(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post(f"/rides/{uuid.uuid4()}/cancel", json={}, headers=headers)
        assert resp.status_code == 404

    async def test_driver_cannot_cancel_via_passenger_endpoint(self, client, driver_headers, fresh_passenger_headers):
        p_headers, _ = fresh_passenger_headers
        d_headers, _ = driver_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            create_resp = await client.post("/rides", json=_ride_payload(), headers=p_headers)
            ride_id = create_resp.json()["id"]
            resp = await client.post(f"/rides/{ride_id}/cancel", json={}, headers=d_headers)
        assert resp.status_code == 403

    async def test_cannot_cancel_already_cancelled_ride(self, client, fresh_passenger_headers):
        headers, _ = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            create_resp = await client.post("/rides", json=_ride_payload(), headers=headers)
            ride_id = create_resp.json()["id"]
            await client.post(f"/rides/{ride_id}/cancel", json={}, headers=headers)
            resp = await client.post(f"/rides/{ride_id}/cancel", json={}, headers=headers)
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Driver accept / reject / start / end  (with manually assigned ride)
# ---------------------------------------------------------------------------

async def _create_assigned_ride(db, client, passenger, driver):
    """Create a ride directly in DB with status=assigned for the given driver."""
    ride = Ride(
        id=uuid.uuid4(),
        passenger_id=passenger.id,
        driver_id=driver.id,
        status=RideStatus.assigned,
        pickup_lat=32.08,
        pickup_lng=34.78,
        dropoff_lat=32.10,
        dropoff_lng=34.80,
        pickup_address="מוצא",
        dropoff_address="יעד",
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(ride)
    await db.commit()
    await db.refresh(ride)
    return ride


class TestDriverActions:
    @pytest_asyncio.fixture
    async def setup_pair(self, db):
        passenger = await make_user(db, f"97250{uuid.uuid4().int % 10000000:07d}", UserRole.passenger)
        driver = await make_user(db, f"97250{uuid.uuid4().int % 10000000:07d}", UserRole.driver, accepted_tos=False)
        return passenger, driver

    def _driver_token_headers(self, driver: User) -> dict:
        from core.security import create_access_token
        token = create_access_token(str(driver.id), "driver")
        return {"Authorization": f"Bearer {token}"}

    async def test_driver_can_accept_assigned_ride(self, client, db, setup_pair):
        passenger, driver = setup_pair
        ride = await _create_assigned_ride(db, client, passenger, driver)
        headers = self._driver_token_headers(driver)
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post(f"/rides/{ride.id}/accept", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

    async def test_driver_can_reject_assigned_ride(self, client, db, setup_pair):
        passenger, driver = setup_pair
        ride = await _create_assigned_ride(db, client, passenger, driver)
        headers = self._driver_token_headers(driver)
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post(f"/rides/{ride.id}/reject", json={}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    async def test_driver_cannot_accept_another_drivers_ride(self, client, db, setup_pair):
        passenger, driver = setup_pair
        other_driver = await make_user(db, f"97250{uuid.uuid4().int % 10000000:07d}", UserRole.driver, accepted_tos=False)
        ride = await _create_assigned_ride(db, client, passenger, driver)
        headers = self._driver_token_headers(other_driver)
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post(f"/rides/{ride.id}/accept", headers=headers)
        assert resp.status_code == 403

    async def test_full_ride_lifecycle_accepted_to_completed(self, client, db, setup_pair):
        """accept → start → end (with payment mocked)."""
        passenger, driver = setup_pair
        ride = await _create_assigned_ride(db, client, passenger, driver)
        headers = self._driver_token_headers(driver)

        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None), \
             patch("services.payment.process_payment", new_callable=AsyncMock):
            # accept
            r1 = await client.post(f"/rides/{ride.id}/accept", headers=headers)
            assert r1.json()["status"] == "accepted"

            # start
            r2 = await client.post(f"/rides/{ride.id}/start", headers=headers)
            assert r2.json()["status"] == "in_progress"

            # end
            r3 = await client.post(f"/rides/{ride.id}/end", headers=headers)
            assert r3.json()["status"] == "completed"

    async def test_cannot_start_without_accepting(self, client, db, setup_pair):
        passenger, driver = setup_pair
        ride = await _create_assigned_ride(db, client, passenger, driver)
        headers = self._driver_token_headers(driver)
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post(f"/rides/{ride.id}/start", headers=headers)
        assert resp.status_code == 409

    async def test_cannot_end_without_starting(self, client, db, setup_pair):
        passenger, driver = setup_pair
        ride = await _create_assigned_ride(db, client, passenger, driver)
        headers = self._driver_token_headers(driver)
        # Accept first, but don't start
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            await client.post(f"/rides/{ride.id}/accept", headers=headers)
            resp = await client.post(f"/rides/{ride.id}/end", headers=headers)
        assert resp.status_code == 409

    async def test_passenger_cannot_use_driver_endpoints(self, client, db, setup_pair, fresh_passenger_headers):
        passenger, driver = setup_pair
        ride = await _create_assigned_ride(db, client, passenger, driver)
        p_headers, _ = fresh_passenger_headers
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            resp = await client.post(f"/rides/{ride.id}/accept", headers=p_headers)
        assert resp.status_code == 403

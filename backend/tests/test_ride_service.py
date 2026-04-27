"""
Unit tests for the ride service layer (services/ride.py):
  - _haversine_km: distance formula
  - request_ride: TOS gate, state transitions
  - cancel_ride_by_passenger: ownership, status gates
  - accept/reject/start/end: driver ownership, status state machine
"""
import math
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from models.ride import Ride, RideStatus
from models.user import User, UserRole
from services.ride import _haversine_km
from tests.conftest import make_user

WA_PATCH = "services.whatsapp.send_text"
PUSH_PATCH = "services.push.send_event"


# ---------------------------------------------------------------------------
# _haversine_km
# ---------------------------------------------------------------------------

class TestHaversine:
    def test_same_point_is_zero(self):
        assert _haversine_km(32.0, 34.0, 32.0, 34.0) == pytest.approx(0.0, abs=0.001)

    def test_tel_aviv_to_jerusalem_approx_55km(self):
        # Tel Aviv ~32.08, 34.78  →  Jerusalem ~31.76, 35.21
        km = _haversine_km(32.08, 34.78, 31.76, 35.21)
        assert 50 < km < 65

    def test_north_south_pole_is_max(self):
        km = _haversine_km(90.0, 0.0, -90.0, 0.0)
        assert km == pytest.approx(20015.0, rel=0.01)

    def test_symmetrical(self):
        a = _haversine_km(32.08, 34.78, 31.76, 35.21)
        b = _haversine_km(31.76, 35.21, 32.08, 34.78)
        assert a == pytest.approx(b, rel=1e-6)

    def test_short_distance(self):
        # ~100m
        km = _haversine_km(32.0800, 34.7800, 32.0810, 34.7800)
        assert 0.05 < km < 0.15


# ---------------------------------------------------------------------------
# request_ride
# ---------------------------------------------------------------------------

class TestRequestRide:
    @pytest_asyncio.fixture
    async def passenger(self, db):
        return await make_user(db, "972501200001", UserRole.passenger)

    @pytest_asyncio.fixture
    async def passenger_no_tos(self, db):
        return await make_user(db, "972501200002", UserRole.passenger, accepted_tos=False)

    def _payload(self):
        from schemas.ride import RideRequest
        return RideRequest(
            pickup_lat=32.08, pickup_lng=34.78,
            dropoff_lat=32.10, dropoff_lng=34.80,
            pickup_address="מוצא", dropoff_address="יעד",
        )

    async def test_tos_not_accepted_raises_403(self, db, passenger_no_tos):
        from fastapi import HTTPException
        from services.ride import request_ride
        with pytest.raises(HTTPException) as exc_info:
            with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
                await request_ride(db, passenger_no_tos, self._payload())
        assert exc_info.value.status_code == 403

    async def test_driver_cannot_request_ride(self, db):
        from fastapi import HTTPException
        from services.ride import request_ride
        driver = await make_user(db, "972502200001", UserRole.driver, accepted_tos=False)
        with pytest.raises(HTTPException) as exc_info:
            with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
                await request_ride(db, driver, self._payload())
        assert exc_info.value.status_code == 403

    async def test_ride_created_with_pending_status_when_no_driver(self, db, passenger):
        from services.ride import request_ride
        with patch("services.ride._find_available_driver", return_value=None), \
             patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            ride = await request_ride(db, passenger, self._payload())
        assert ride.status == RideStatus.pending
        assert ride.passenger_id == passenger.id

    async def test_ride_assigned_when_driver_available(self, db, passenger):
        from services.ride import request_ride
        mock_driver = await make_user(db, "972503200001", UserRole.driver, accepted_tos=False)
        with patch("services.ride._find_available_driver", return_value=mock_driver), \
             patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            ride = await request_ride(db, passenger, self._payload())
        assert ride.status == RideStatus.assigned
        assert ride.driver_id == mock_driver.id
        assert ride.assigned_at is not None


# ---------------------------------------------------------------------------
# cancel_ride_by_passenger
# ---------------------------------------------------------------------------

class TestCancelRide:
    async def _make_ride(self, db, passenger, status=RideStatus.pending, driver=None):
        ride = Ride(
            id=uuid.uuid4(),
            passenger_id=passenger.id,
            driver_id=driver.id if driver else None,
            status=status,
            pickup_lat=32.08, pickup_lng=34.78,
            dropoff_lat=32.10, dropoff_lng=34.80,
        )
        db.add(ride)
        await db.commit()
        await db.refresh(ride)
        return ride

    async def test_cancel_pending_ride(self, db):
        from services.ride import cancel_ride_by_passenger
        from schemas.ride import CancelRequest
        passenger = await make_user(db, "972501300001", UserRole.passenger)
        ride = await self._make_ride(db, passenger)
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            result = await cancel_ride_by_passenger(db, passenger, ride.id, CancelRequest())
        assert result.status == RideStatus.cancelled

    async def test_cancel_wrong_passenger_raises_403(self, db):
        from fastapi import HTTPException
        from services.ride import cancel_ride_by_passenger
        from schemas.ride import CancelRequest
        passenger = await make_user(db, "972501300002", UserRole.passenger)
        other = await make_user(db, "972501300003", UserRole.passenger)
        ride = await self._make_ride(db, passenger)
        with pytest.raises(HTTPException) as exc:
            with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
                await cancel_ride_by_passenger(db, other, ride.id, CancelRequest())
        assert exc.value.status_code == 403

    async def test_cancel_completed_ride_raises_409(self, db):
        from fastapi import HTTPException
        from services.ride import cancel_ride_by_passenger
        from schemas.ride import CancelRequest
        passenger = await make_user(db, "972501300004", UserRole.passenger)
        ride = await self._make_ride(db, passenger, status=RideStatus.completed)
        with pytest.raises(HTTPException) as exc:
            with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
                await cancel_ride_by_passenger(db, passenger, ride.id, CancelRequest())
        assert exc.value.status_code == 409

    async def test_cancel_nonexistent_ride_raises_404(self, db):
        from fastapi import HTTPException
        from services.ride import cancel_ride_by_passenger
        from schemas.ride import CancelRequest
        passenger = await make_user(db, "972501300005", UserRole.passenger)
        with pytest.raises(HTTPException) as exc:
            with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
                await cancel_ride_by_passenger(db, passenger, uuid.uuid4(), CancelRequest())
        assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Driver state machine
# ---------------------------------------------------------------------------

class TestDriverStateMachine:
    async def _make_ride(self, db, passenger, driver, status):
        ride = Ride(
            id=uuid.uuid4(),
            passenger_id=passenger.id,
            driver_id=driver.id,
            status=status,
            pickup_lat=32.08, pickup_lng=34.78,
            dropoff_lat=32.10, dropoff_lng=34.80,
            assigned_at=datetime.now(timezone.utc),
        )
        db.add(ride)
        await db.commit()
        await db.refresh(ride)
        return ride

    async def test_accept_sets_accepted_status(self, db):
        from services.ride import accept_ride
        passenger = await make_user(db, "972501400001", UserRole.passenger)
        driver = await make_user(db, "972502400001", UserRole.driver, accepted_tos=False)
        ride = await self._make_ride(db, passenger, driver, RideStatus.assigned)
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            result = await accept_ride(db, driver, ride.id)
        assert result.status == RideStatus.accepted
        assert result.accepted_at is not None

    async def test_accept_wrong_status_raises_409(self, db):
        from fastapi import HTTPException
        from services.ride import accept_ride
        passenger = await make_user(db, "972501400002", UserRole.passenger)
        driver = await make_user(db, "972502400002", UserRole.driver, accepted_tos=False)
        ride = await self._make_ride(db, passenger, driver, RideStatus.accepted)  # already accepted
        with pytest.raises(HTTPException) as exc:
            with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
                await accept_ride(db, driver, ride.id)
        assert exc.value.status_code == 409

    async def test_start_ride_sets_in_progress(self, db):
        from services.ride import start_ride
        passenger = await make_user(db, "972501400003", UserRole.passenger)
        driver = await make_user(db, "972502400003", UserRole.driver, accepted_tos=False)
        ride = await self._make_ride(db, passenger, driver, RideStatus.accepted)
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
            result = await start_ride(db, driver, ride.id)
        assert result.status == RideStatus.in_progress
        assert result.started_at is not None

    async def test_end_ride_sets_completed(self, db):
        from services.ride import end_ride
        passenger = await make_user(db, "972501400004", UserRole.passenger)
        driver = await make_user(db, "972502400004", UserRole.driver, accepted_tos=False)
        ride = await self._make_ride(db, passenger, driver, RideStatus.in_progress)
        with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None), \
             patch("services.payment.process_payment", new_callable=AsyncMock):
            result = await end_ride(db, driver, ride.id)
        assert result.status == RideStatus.completed
        assert result.completed_at is not None

    async def test_wrong_driver_raises_403(self, db):
        from fastapi import HTTPException
        from services.ride import accept_ride
        passenger = await make_user(db, "972501400005", UserRole.passenger)
        driver = await make_user(db, "972502400005", UserRole.driver, accepted_tos=False)
        other_driver = await make_user(db, "972502400006", UserRole.driver, accepted_tos=False)
        ride = await self._make_ride(db, passenger, driver, RideStatus.assigned)
        with pytest.raises(HTTPException) as exc:
            with patch(WA_PATCH, return_value=True), patch(PUSH_PATCH, return_value=None):
                await accept_ride(db, other_driver, ride.id)
        assert exc.value.status_code == 403

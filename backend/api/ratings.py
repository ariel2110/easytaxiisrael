"""
Rating endpoints.

POST /rides/{id}/ratings/driver      — passenger rates driver
POST /rides/{id}/ratings/passenger   — driver rates passenger
GET  /rides/{id}/ratings             — both participants + admin
GET  /drivers/{id}/stats             — public driver reputation stats
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.user import User
from schemas.rating import DriverStats, RatingCreate, RatingRead
from services.rating import get_driver_stats, get_ratings_for_ride, rate_driver, rate_passenger

router = APIRouter(tags=["ratings"])


@router.post(
    "/rides/{ride_id}/ratings/driver",
    response_model=RatingRead,
    summary="Passenger rates their driver after a completed ride",
)
async def passenger_rates_driver(
    ride_id: uuid.UUID,
    payload: RatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("passenger")),
) -> RatingRead:
    return await rate_driver(db, ride_id, current_user, payload)


@router.post(
    "/rides/{ride_id}/ratings/passenger",
    response_model=RatingRead,
    summary="Driver rates their passenger after a completed ride",
)
async def driver_rates_passenger(
    ride_id: uuid.UUID,
    payload: RatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("driver")),
) -> RatingRead:
    return await rate_passenger(db, ride_id, current_user, payload)


@router.get(
    "/rides/{ride_id}/ratings",
    response_model=list[RatingRead],
    summary="Get all ratings for a ride (participants + admin only)",
)
async def list_ride_ratings(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RatingRead]:
    return await get_ratings_for_ride(db, ride_id, current_user)


@router.get(
    "/drivers/{driver_id}/stats",
    response_model=DriverStats,
    summary="Public driver reputation stats (average score + total ratings)",
)
async def driver_reputation(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DriverStats:
    return await get_driver_stats(db, driver_id)

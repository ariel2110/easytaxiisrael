"""
Rating service — create and query ride ratings.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.rating import Rating, RatingDirection
from models.ride import Ride, RideStatus
from models.user import User, UserRole
from schemas.rating import DriverStats, RatingCreate, RatingRead


async def rate_driver(
    db: AsyncSession,
    ride_id: uuid.UUID,
    passenger: User,
    payload: RatingCreate,
) -> RatingRead:
    """Passenger rates driver after a completed ride."""
    ride = await db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

    if ride.passenger_id != passenger.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ride")

    if ride.status != RideStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Can only rate completed rides",
        )
    if ride.driver_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ride had no driver")

    # Idempotency guard
    existing = await db.execute(
        select(Rating).where(
            Rating.ride_id == ride_id,
            Rating.direction == RatingDirection.passenger_to_driver,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already rated this ride",
        )

    rating = Rating(
        ride_id=ride_id,
        rater_id=passenger.id,
        ratee_id=ride.driver_id,
        direction=RatingDirection.passenger_to_driver,
        score=payload.score,
        comment=payload.comment,
    )
    db.add(rating)
    await db.commit()
    await db.refresh(rating)
    return RatingRead.model_validate(rating)


async def rate_passenger(
    db: AsyncSession,
    ride_id: uuid.UUID,
    driver: User,
    payload: RatingCreate,
) -> RatingRead:
    """Driver rates passenger after a completed ride."""
    ride = await db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

    if ride.driver_id != driver.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ride")

    if ride.status != RideStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Can only rate completed rides",
        )

    existing = await db.execute(
        select(Rating).where(
            Rating.ride_id == ride_id,
            Rating.direction == RatingDirection.driver_to_passenger,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already rated this ride",
        )

    rating = Rating(
        ride_id=ride_id,
        rater_id=driver.id,
        ratee_id=ride.passenger_id,
        direction=RatingDirection.driver_to_passenger,
        score=payload.score,
        comment=payload.comment,
    )
    db.add(rating)
    await db.commit()
    await db.refresh(rating)
    return RatingRead.model_validate(rating)


async def get_driver_stats(
    db: AsyncSession,
    driver_id: uuid.UUID,
) -> DriverStats:
    """Return average score + count for a driver."""
    result = await db.execute(
        select(
            func.avg(Rating.score).label("avg_score"),
            func.count(Rating.id).label("count"),
        ).where(
            Rating.ratee_id == driver_id,
            Rating.direction == RatingDirection.passenger_to_driver,
        )
    )
    row = result.one()
    avg = float(round(row.avg_score, 2)) if row.avg_score is not None else None
    return DriverStats(driver_id=driver_id, average_score=avg, total_ratings=row.count)


async def get_ratings_for_ride(
    db: AsyncSession,
    ride_id: uuid.UUID,
    requester: User,
) -> list[RatingRead]:
    """Return all ratings for a ride (only visible to participants + admin)."""
    ride = await db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

    if requester.role != UserRole.admin and requester.id not in (ride.passenger_id, ride.driver_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Rating).where(Rating.ride_id == ride_id))
    return [RatingRead.model_validate(r) for r in result.scalars().all()]

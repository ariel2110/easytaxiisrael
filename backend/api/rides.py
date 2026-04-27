import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.audit import AuditAction
from models.user import User, UserRole
from schemas.ride import CancelRequest, RideRead, RideRequest
from security.audit import audit
from services import ride as ride_service

router = APIRouter(prefix="/rides", tags=["rides"])


# ---------------------------------------------------------------------------
# Passenger endpoints
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=RideRead,
    status_code=status.HTTP_201_CREATED,
    summary="Request a new ride",
)
async def request_ride(
    payload: RideRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger, UserRole.admin)),
) -> RideRead:
    ride = await ride_service.request_ride(db, current_user, payload)
    await audit(db, AuditAction.ride_requested, actor_id=current_user.id,
                resource_type="ride", resource_id=str(ride.id),
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return ride


@router.post(
    "/{ride_id}/cancel",
    response_model=RideRead,
    summary="Cancel a ride (passenger)",
)
async def cancel_ride(
    ride_id: uuid.UUID,
    request: Request,
    payload: CancelRequest = CancelRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger, UserRole.admin)),
) -> RideRead:
    ride = await ride_service.cancel_ride_by_passenger(db, current_user, ride_id, payload)
    await audit(db, AuditAction.ride_cancelled, actor_id=current_user.id,
                resource_type="ride", resource_id=str(ride_id),
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return ride


# ---------------------------------------------------------------------------
# Driver endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{ride_id}/accept",
    response_model=RideRead,
    summary="Accept an assigned ride (driver)",
)
async def accept_ride(
    ride_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> RideRead:
    ride = await ride_service.accept_ride(db, current_user, ride_id)
    await audit(db, AuditAction.ride_accepted, actor_id=current_user.id,
                resource_type="ride", resource_id=str(ride_id),
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return ride


@router.post(
    "/{ride_id}/reject",
    response_model=RideRead,
    summary="Reject an assigned ride (driver)",
)
async def reject_ride(
    ride_id: uuid.UUID,
    request: Request,
    payload: CancelRequest = CancelRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> RideRead:
    ride = await ride_service.reject_ride(db, current_user, ride_id, payload)
    await audit(db, AuditAction.ride_rejected, actor_id=current_user.id,
                resource_type="ride", resource_id=str(ride_id),
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return ride


@router.post(
    "/{ride_id}/start",
    response_model=RideRead,
    summary="Start an accepted ride (driver)",
)
async def start_ride(
    ride_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> RideRead:
    ride = await ride_service.start_ride(db, current_user, ride_id)
    await audit(db, AuditAction.ride_started, actor_id=current_user.id,
                resource_type="ride", resource_id=str(ride_id),
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return ride


@router.post(
    "/{ride_id}/end",
    response_model=RideRead,
    summary="End an in-progress ride (driver)",
)
async def end_ride(
    ride_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> RideRead:
    ride = await ride_service.end_ride(db, current_user, ride_id)
    await audit(db, AuditAction.ride_ended, actor_id=current_user.id,
                resource_type="ride", resource_id=str(ride_id),
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return ride


# ---------------------------------------------------------------------------
# Shared endpoints
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=list[RideRead],
    summary="List rides for the current user",
)
async def list_rides(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RideRead]:
    return await ride_service.list_rides_for_user(db, current_user)


@router.get(
    "/{ride_id}",
    response_model=RideRead,
    summary="Get a ride by ID",
)
async def get_ride(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RideRead:
    return await ride_service.get_ride(db, ride_id)

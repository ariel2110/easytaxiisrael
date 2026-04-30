"""
Admin API — platform management endpoints (admin role only).

GET  /admin/users                    — list all users (paginated)
GET  /admin/users/{id}               — get single user
PATCH /admin/users/{id}/activate     — activate user
PATCH /admin/users/{id}/deactivate   — deactivate user
GET  /admin/drivers                  — list drivers with compliance + wallet
GET  /admin/stats                    — platform-wide statistics
GET  /admin/audit-logs               — recent audit trail (paginated)
GET  /admin/rides                    — all rides (paginated, filterable by status)
"""

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import require_admin_key
from models.audit import AuditAction, AuditLog
from models.payment import DriverWallet, RidePayment
from models.rating import Rating, RatingDirection
from models.ride import Ride, RideStatus
from models.user import User, UserRole, AuthStatus, DriverType
from security.audit import audit

router = APIRouter(prefix="/admin", tags=["admin"])
_admin = require_admin_key


# ---------------------------------------------------------------------------
# Schemas (admin-only — not reused elsewhere)
# ---------------------------------------------------------------------------

class UserAdminRead(BaseModel):
    id: uuid.UUID
    phone: str
    role: str
    driver_type: str | None = None
    auth_status: str | None = None
    is_active: bool
    full_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DriverAdminRead(BaseModel):
    id: uuid.UUID
    phone: str
    is_active: bool
    wallet_balance: float | None
    average_rating: float | None
    total_ratings: int
    created_at: datetime


class PlatformStats(BaseModel):
    total_users: int
    total_drivers: int
    total_passengers: int
    active_drivers: int
    total_rides: int
    completed_rides: int
    cancelled_rides: int
    pending_rides: int
    total_revenue: float
    total_payments: int


class AuditLogRead(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    detail: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserAdminRead], summary="List all users")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: UserRole | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> list[UserAdminRead]:
    q = select(User).offset(skip).limit(limit).order_by(User.created_at.desc())
    if role:
        q = q.where(User.role == role)
    result = await db.execute(q)
    return [UserAdminRead.model_validate(u) for u in result.scalars().all()]


@router.get("/users/{user_id}", response_model=UserAdminRead, summary="Get a single user")
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserAdminRead.model_validate(user)


@router.patch(
    "/users/{user_id}/activate",
    response_model=UserAdminRead,
    summary="Activate a user account",
)
async def activate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = True
    await audit(db, AuditAction.admin_evaluate_driver, actor_id=admin.id,
                resource_type="user", resource_id=str(user_id),
                detail="activated")
    await db.commit()
    await db.refresh(user)
    return UserAdminRead.model_validate(user)


@router.patch(
    "/users/{user_id}/deactivate",
    response_model=UserAdminRead,
    summary="Deactivate (ban) a user account",
)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot deactivate an admin account",
        )
    user.is_active = False
    await audit(db, AuditAction.admin_evaluate_driver, actor_id=admin.id,
                resource_type="user", resource_id=str(user_id),
                detail="deactivated")
    await db.commit()
    await db.refresh(user)
    return UserAdminRead.model_validate(user)


@router.patch(
    "/users/{user_id}/approve",
    response_model=UserAdminRead,
    summary="Approve a driver — set auth_status=approved",
)
async def approve_driver(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != UserRole.driver:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a driver")
    user.auth_status = AuthStatus.approved
    user.is_active = True
    await audit(db, AuditAction.admin_evaluate_driver, actor_id=admin.id,
                resource_type="user", resource_id=str(user_id),
                detail="approved")
    await db.commit()
    await db.refresh(user)
    return UserAdminRead.model_validate(user)


class SetDriverTypeRequest(BaseModel):
    driver_type: Literal["licensed_taxi", "rideshare"]


@router.patch(
    "/users/{user_id}/driver-type",
    response_model=UserAdminRead,
    summary="Set driver type (licensed_taxi / rideshare)",
)
async def set_driver_type(
    user_id: uuid.UUID,
    body: SetDriverTypeRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != UserRole.driver:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a driver")
    user.driver_type = DriverType(body.driver_type)
    await audit(db, AuditAction.admin_evaluate_driver, actor_id=admin.id,
                resource_type="user", resource_id=str(user_id),
                detail=f"driver_type set to {body.driver_type}")
    await db.commit()
    await db.refresh(user)
    return UserAdminRead.model_validate(user)


# ---------------------------------------------------------------------------
# Driver overview
# ---------------------------------------------------------------------------

@router.get("/drivers", response_model=list[DriverAdminRead], summary="List drivers with stats")
async def list_drivers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> list[DriverAdminRead]:
    q = select(User).where(User.role == UserRole.driver).offset(skip).limit(limit)
    if active_only:
        q = q.where(User.is_active.is_(True))
    drivers_result = await db.execute(q)
    drivers = list(drivers_result.scalars().all())
    driver_ids = [d.id for d in drivers]

    # Wallet balances
    wallets_result = await db.execute(
        select(DriverWallet).where(DriverWallet.driver_id.in_(driver_ids))
    )
    wallet_map = {w.driver_id: float(w.balance) for w in wallets_result.scalars().all()}

    # Average ratings
    ratings_result = await db.execute(
        select(
            Rating.ratee_id,
            func.avg(Rating.score).label("avg"),
            func.count(Rating.id).label("cnt"),
        )
        .where(
            Rating.ratee_id.in_(driver_ids),
            Rating.direction == RatingDirection.passenger_to_driver,
        )
        .group_by(Rating.ratee_id)
    )
    rating_map = {row.ratee_id: (round(float(row.avg), 2), row.cnt) for row in ratings_result}

    out = []
    for d in drivers:
        avg, cnt = rating_map.get(d.id, (None, 0))
        out.append(DriverAdminRead(
            id=d.id,
            phone=d.phone,
            is_active=d.is_active,
            wallet_balance=wallet_map.get(d.id),
            average_rating=avg,
            total_ratings=cnt,
            created_at=d.created_at,
        ))
    return out


# ---------------------------------------------------------------------------
# Platform statistics
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=PlatformStats, summary="Platform-wide statistics")
async def platform_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> PlatformStats:
    # User counts
    user_counts = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    role_count: dict[str, int] = {row[0].value: row[1] for row in user_counts}

    active_drivers_r = await db.execute(
        select(func.count(User.id)).where(
            User.role == UserRole.driver,
            User.is_active.is_(True),
        )
    )

    # Ride counts
    ride_counts = await db.execute(
        select(Ride.status, func.count(Ride.id)).group_by(Ride.status)
    )
    status_count: dict[str, int] = {row[0].value: row[1] for row in ride_counts}

    # Revenue (sum of platform_fee for completed payments)
    revenue_r = await db.execute(
        select(func.sum(RidePayment.platform_fee)).where(
            RidePayment.status.in_(["completed"])
        )
    )
    revenue = float(revenue_r.scalar() or 0)

    total_payments_r = await db.execute(select(func.count(RidePayment.id)))

    return PlatformStats(
        total_users=sum(role_count.values()),
        total_drivers=role_count.get("driver", 0),
        total_passengers=role_count.get("passenger", 0),
        active_drivers=active_drivers_r.scalar() or 0,
        total_rides=sum(status_count.values()),
        completed_rides=status_count.get("completed", 0),
        cancelled_rides=status_count.get("cancelled", 0),
        pending_rides=status_count.get("pending", 0),
        total_revenue=revenue,
        total_payments=total_payments_r.scalar() or 0,
    )


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@router.get("/audit-logs", response_model=list[AuditLogRead], summary="Recent audit trail")
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    actor_id: uuid.UUID | None = Query(None),
    action: AuditAction | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> list[AuditLogRead]:
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    if actor_id:
        q = q.where(AuditLog.actor_id == actor_id)
    if action:
        q = q.where(AuditLog.action == action)
    result = await db.execute(q)
    return [AuditLogRead.model_validate(r) for r in result.scalars().all()]


# ---------------------------------------------------------------------------
# Rides overview
# ---------------------------------------------------------------------------

@router.get("/rides", response_model=list[dict], summary="All rides (admin view, paginated)")
async def list_all_rides(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    ride_status: RideStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> list[dict]:
    q = select(Ride).order_by(Ride.created_at.desc()).offset(skip).limit(limit)
    if ride_status:
        q = q.where(Ride.status == ride_status)
    result = await db.execute(q)
    rides = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "status": r.status.value,
            "passenger_id": str(r.passenger_id),
            "driver_id": str(r.driver_id) if r.driver_id else None,
            "pickup_address": r.pickup_address,
            "dropoff_address": r.dropoff_address,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in rides
    ]

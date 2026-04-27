import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.audit import AuditAction
from models.user import User, UserRole
from schemas.payment import DriverWalletRead, FareEstimate, RidePaymentRead, WalletEntryRead
from security.audit import audit
from services import payment as payment_service

router = APIRouter(tags=["payments"])


# ---------------------------------------------------------------------------
# Fare & payment
# ---------------------------------------------------------------------------

@router.get(
    "/rides/{ride_id}/fare",
    response_model=FareEstimate,
    summary="Estimate fare for a ride",
)
async def estimate_fare(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FareEstimate:
    return await payment_service.get_fare_estimate(db, ride_id)


@router.post(
    "/rides/{ride_id}/payment",
    response_model=RidePaymentRead,
    summary="Process payment for a completed ride",
)
async def process_payment(
    ride_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger, UserRole.admin)),
) -> RidePaymentRead:
    payment = await payment_service.process_payment(db, ride_id)
    action = AuditAction.payment_processed if payment.status.value == "completed" else AuditAction.payment_failed
    await audit(db, action, actor_id=current_user.id,
                resource_type="payment", resource_id=str(payment.id),
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return payment


@router.get(
    "/rides/{ride_id}/payment",
    response_model=RidePaymentRead,
    summary="Get payment record for a ride",
)
async def get_ride_payment(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RidePaymentRead:
    return await payment_service.get_payment_for_ride(db, ride_id)


# ---------------------------------------------------------------------------
# Driver wallet
# ---------------------------------------------------------------------------

@router.get(
    "/wallet",
    response_model=DriverWalletRead,
    summary="Get the authenticated driver's wallet",
)
async def get_my_wallet(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> DriverWalletRead:
    return await payment_service.get_driver_wallet(db, current_user.id)


@router.get(
    "/wallet/transactions",
    response_model=list[WalletEntryRead],
    summary="Get wallet transaction history for the authenticated driver",
)
async def get_wallet_transactions(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> list[WalletEntryRead]:
    wallet = await payment_service.get_driver_wallet(db, current_user.id)
    return await payment_service.get_wallet_entries(db, wallet.id, limit=limit)


@router.get(
    "/admin/wallets/{driver_id}",
    response_model=DriverWalletRead,
    summary="[Admin] Get any driver's wallet",
)
async def admin_get_wallet(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> DriverWalletRead:
    return await payment_service.get_driver_wallet(db, driver_id)


@router.get(
    "/admin/wallets/{driver_id}/transactions",
    response_model=list[WalletEntryRead],
    summary="[Admin] Get any driver's wallet transaction history",
)
async def admin_get_wallet_transactions(
    driver_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[WalletEntryRead]:
    wallet = await payment_service.get_driver_wallet(db, driver_id)
    return await payment_service.get_wallet_entries(db, wallet.id, limit=limit)

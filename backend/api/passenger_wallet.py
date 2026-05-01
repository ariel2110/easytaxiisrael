"""
Passenger wallet API endpoints.

Routes:
  GET  /passenger/wallet              — balance + recent entries + profile type
  POST /passenger/wallet/topup        — charge a saved card → credit wallet
  GET  /passenger/payment-methods     — list saved cards
  POST /passenger/payment-methods     — add a new card (via Grow token)
  PUT  /passenger/payment-methods/{id}/default — set as default
  DELETE /passenger/payment-methods/{id}       — remove a card
  GET  /passenger/payment-profile     — get personal/business toggle
  PATCH /passenger/payment-profile    — update personal/business + business details
"""

import uuid
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.passenger_wallet import (
    PassengerPaymentMethod,
    PassengerWallet,
    PassengerWalletEntry,
    PassengerWalletEntryType,
    PaymentProfile,
)
from models.user import User, UserRole
from schemas.passenger_wallet import (
    AddPaymentMethodRequest,
    PassengerPaymentMethodRead,
    PassengerWalletEntryRead,
    PassengerWalletRead,
    PaymentProfileRead,
    UpdatePaymentProfileRequest,
    WalletTopUpRequest,
    WalletWithHistory,
)
from services import grow as grow_service

router = APIRouter(prefix="/passenger", tags=["passenger-wallet"])

_CENT = Decimal("0.01")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_wallet(db: AsyncSession, passenger_id: uuid.UUID) -> PassengerWallet:
    result = await db.execute(
        select(PassengerWallet).where(PassengerWallet.passenger_id == passenger_id)
    )
    wallet = result.scalar_one_or_none()
    if wallet is None:
        wallet = PassengerWallet(passenger_id=passenger_id, balance=Decimal("0"))
        db.add(wallet)
        await db.flush()
    return wallet


# ---------------------------------------------------------------------------
# Wallet overview
# ---------------------------------------------------------------------------

@router.get("/wallet", response_model=WalletWithHistory, summary="Get wallet + recent history")
async def get_wallet(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger)),
) -> WalletWithHistory:
    wallet = await _get_or_create_wallet(db, current_user.id)
    await db.flush()

    entries_result = await db.execute(
        select(PassengerWalletEntry)
        .where(PassengerWalletEntry.wallet_id == wallet.id)
        .order_by(PassengerWalletEntry.created_at.desc())
        .limit(30)
    )
    entries = entries_result.scalars().all()

    profile = PaymentProfileRead(
        payment_profile=PaymentProfile(current_user.payment_profile or "personal"),
        business_name=current_user.business_name,
        business_tax_id=current_user.business_tax_id,
        business_email=current_user.business_email,
    )

    return WalletWithHistory(
        wallet=PassengerWalletRead.model_validate(wallet),
        entries=[PassengerWalletEntryRead.model_validate(e) for e in entries],
        payment_profile=profile,
    )


# ---------------------------------------------------------------------------
# Top-up
# ---------------------------------------------------------------------------

@router.post("/wallet/topup", response_model=PassengerWalletRead, summary="Top up wallet via saved card")
async def topup_wallet(
    body: WalletTopUpRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger)),
) -> PassengerWalletRead:
    # Fetch the payment method
    pm_result = await db.execute(
        select(PassengerPaymentMethod).where(
            PassengerPaymentMethod.id == body.payment_method_id,
            PassengerPaymentMethod.passenger_id == current_user.id,
        )
    )
    pm = pm_result.scalar_one_or_none()
    if pm is None:
        raise HTTPException(status_code=404, detail="אמצעי תשלום לא נמצא")

    # Charge via Grow
    amount = body.amount_ils.quantize(_CENT, rounding=ROUND_HALF_UP)
    idempotency = f"topup-{current_user.id}-{body.payment_method_id}-{int(amount * 100)}"
    charge = await grow_service.charge_token(
        grow_token=pm.grow_token,
        amount_ils=amount,
        description=f"טעינת ארנק EasyTaxi ₪{amount}",
        idempotency_key=idempotency,
    )

    # Credit wallet
    wallet = await _get_or_create_wallet(db, current_user.id)
    new_balance = (Decimal(str(wallet.balance)) + amount).quantize(_CENT, rounding=ROUND_HALF_UP)
    wallet.balance = new_balance

    entry = PassengerWalletEntry(
        wallet_id=wallet.id,
        entry_type=PassengerWalletEntryType.credit,
        amount=amount,
        balance_after=new_balance,
        description=f"טעינה בכרטיס ****{pm.card_last4}",
        grow_transaction_id=charge.get("id"),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(wallet)
    return PassengerWalletRead.model_validate(wallet)


# ---------------------------------------------------------------------------
# Payment methods
# ---------------------------------------------------------------------------

@router.get("/payment-methods", response_model=list[PassengerPaymentMethodRead], summary="List saved cards")
async def list_payment_methods(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger)),
) -> list[PassengerPaymentMethodRead]:
    result = await db.execute(
        select(PassengerPaymentMethod)
        .where(PassengerPaymentMethod.passenger_id == current_user.id)
        .order_by(PassengerPaymentMethod.created_at.asc())
    )
    return [PassengerPaymentMethodRead.model_validate(pm) for pm in result.scalars().all()]


@router.post("/payment-methods", response_model=PassengerPaymentMethodRead, status_code=201, summary="Add a card via Grow token")
async def add_payment_method(
    body: AddPaymentMethodRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger)),
) -> PassengerPaymentMethodRead:
    # Count existing cards — limit to 5 for safety
    count_result = await db.execute(
        select(PassengerPaymentMethod).where(
            PassengerPaymentMethod.passenger_id == current_user.id
        )
    )
    existing = count_result.scalars().all()
    if len(existing) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ניתן לשמור עד 5 כרטיסי אשראי",
        )

    is_first = len(existing) == 0
    pm = PassengerPaymentMethod(
        passenger_id=current_user.id,
        grow_token=body.grow_token,
        card_last4=body.card_last4,
        card_brand=body.card_brand,
        card_expiry=body.card_expiry,
        is_default=is_first,
    )
    db.add(pm)
    await db.commit()
    await db.refresh(pm)
    return PassengerPaymentMethodRead.model_validate(pm)


@router.put("/payment-methods/{pm_id}/default", response_model=PassengerPaymentMethodRead, summary="Set card as default")
async def set_default_payment_method(
    pm_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger)),
) -> PassengerPaymentMethodRead:
    # Clear current default
    all_result = await db.execute(
        select(PassengerPaymentMethod).where(
            PassengerPaymentMethod.passenger_id == current_user.id
        )
    )
    for pm in all_result.scalars().all():
        pm.is_default = pm.id == pm_id

    await db.commit()
    result = await db.execute(
        select(PassengerPaymentMethod).where(PassengerPaymentMethod.id == pm_id)
    )
    pm = result.scalar_one_or_none()
    if pm is None:
        raise HTTPException(status_code=404, detail="כרטיס לא נמצא")
    return PassengerPaymentMethodRead.model_validate(pm)


@router.delete("/payment-methods/{pm_id}", status_code=204, summary="Remove a saved card")
async def delete_payment_method(
    pm_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger)),
) -> None:
    result = await db.execute(
        select(PassengerPaymentMethod).where(
            PassengerPaymentMethod.id == pm_id,
            PassengerPaymentMethod.passenger_id == current_user.id,
        )
    )
    pm = result.scalar_one_or_none()
    if pm is None:
        raise HTTPException(status_code=404, detail="כרטיס לא נמצא")
    await db.delete(pm)
    await db.commit()


# ---------------------------------------------------------------------------
# Payment profile (personal ↔ business)
# ---------------------------------------------------------------------------

@router.get("/payment-profile", response_model=PaymentProfileRead, summary="Get payment profile type")
async def get_payment_profile(
    current_user: User = Depends(require_roles(UserRole.passenger)),
) -> PaymentProfileRead:
    return PaymentProfileRead(
        payment_profile=PaymentProfile(current_user.payment_profile or "personal"),
        business_name=current_user.business_name,
        business_tax_id=current_user.business_tax_id,
        business_email=current_user.business_email,
    )


@router.patch("/payment-profile", response_model=PaymentProfileRead, summary="Switch personal/business profile")
async def update_payment_profile(
    body: UpdatePaymentProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.passenger)),
) -> PaymentProfileRead:
    current_user.payment_profile = body.payment_profile.value
    if body.business_name is not None:
        current_user.business_name = body.business_name
    if body.business_tax_id is not None:
        current_user.business_tax_id = body.business_tax_id
    if body.business_email is not None:
        current_user.business_email = body.business_email
    await db.commit()
    return PaymentProfileRead(
        payment_profile=PaymentProfile(current_user.payment_profile),
        business_name=current_user.business_name,
        business_tax_id=current_user.business_tax_id,
        business_email=current_user.business_email,
    )

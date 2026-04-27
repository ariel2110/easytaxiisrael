"""
Payment service.

Responsibilities:
  - Haversine distance calculation between ride pickup and dropoff
  - Fare calculation with configurable rates from settings
  - Payment split: platform fee, tax, driver earnings
  - Simulated payment processing (no external provider yet)
  - Driver wallet credit and immutable ledger entries
"""

import math
import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from monitoring.metrics import payments_processed_total, revenue_total

from core.config import settings
from models.payment import DriverWallet, PaymentStatus, RidePayment, WalletEntry, WalletEntryType
from models.ride import Ride, RideStatus
from schemas.payment import FareEstimate

_CENT = Decimal("0.01")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Distance
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> Decimal:
    """Return the great-circle distance in kilometres between two coordinates."""
    R = 6_371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return Decimal(str(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))).quantize(
        _CENT, rounding=ROUND_HALF_UP
    )


# ---------------------------------------------------------------------------
# Fare calculation
# ---------------------------------------------------------------------------

def calculate_fare(ride: Ride) -> FareEstimate:
    distance_km = haversine_km(
        ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng
    )

    base = Decimal(str(settings.FARE_BASE)).quantize(_CENT, rounding=ROUND_HALF_UP)
    per_km = Decimal(str(settings.FARE_PER_KM)).quantize(_CENT, rounding=ROUND_HALF_UP)
    total = (base + per_km * distance_km).quantize(_CENT, rounding=ROUND_HALF_UP)

    platform_fee_pct = Decimal(str(settings.PLATFORM_FEE_PCT)) / 100
    tax_pct = Decimal(str(settings.TAX_PCT)) / 100

    platform_fee = (total * platform_fee_pct).quantize(_CENT, rounding=ROUND_HALF_UP)
    tax_amount = (total * tax_pct).quantize(_CENT, rounding=ROUND_HALF_UP)
    driver_earnings = (total - platform_fee - tax_amount).quantize(
        _CENT, rounding=ROUND_HALF_UP
    )

    return FareEstimate(
        distance_km=distance_km,
        total_amount=total,
        platform_fee=platform_fee,
        tax_amount=tax_amount,
        driver_earnings=driver_earnings,
    )


# ---------------------------------------------------------------------------
# Wallet helpers
# ---------------------------------------------------------------------------

async def _get_or_create_wallet(db: AsyncSession, driver_id: uuid.UUID) -> DriverWallet:
    result = await db.execute(
        select(DriverWallet).where(DriverWallet.driver_id == driver_id)
    )
    wallet = result.scalar_one_or_none()
    if wallet is None:
        wallet = DriverWallet(driver_id=driver_id, balance=Decimal("0"))
        db.add(wallet)
        await db.flush()
    return wallet


async def _credit_wallet(
    db: AsyncSession,
    wallet: DriverWallet,
    amount: Decimal,
    description: str,
    reference_id: uuid.UUID,
) -> WalletEntry:
    wallet.balance = (Decimal(str(wallet.balance)) + amount).quantize(
        _CENT, rounding=ROUND_HALF_UP
    )
    entry = WalletEntry(
        wallet_id=wallet.id,
        entry_type=WalletEntryType.credit,
        amount=amount,
        balance_after=wallet.balance,
        description=description,
        reference_id=reference_id,
    )
    db.add(entry)
    return entry


# ---------------------------------------------------------------------------
# Payment processing
# ---------------------------------------------------------------------------

async def process_payment(db: AsyncSession, ride_id: uuid.UUID) -> RidePayment:
    """
    Simulate charging the passenger, then split and credit the driver wallet.
    Idempotent: returns existing payment if already completed.
    """
    ride = await db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

    if ride.status != RideStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment can only be processed for completed rides",
        )

    # Idempotency guard
    existing = await db.execute(
        select(RidePayment).where(RidePayment.ride_id == ride_id)
    )
    payment = existing.scalar_one_or_none()
    if payment is not None:
        if payment.status == PaymentStatus.completed:
            return payment
        # Retry a failed payment by resetting it below; fall through

    fare = calculate_fare(ride)

    if payment is None:
        payment = RidePayment(
            ride_id=ride.id,
            passenger_id=ride.passenger_id,
            driver_id=ride.driver_id,
            distance_km=fare.distance_km,
            total_amount=fare.total_amount,
            platform_fee=fare.platform_fee,
            tax_amount=fare.tax_amount,
            driver_earnings=fare.driver_earnings,
            status=PaymentStatus.pending,
        )
        db.add(payment)
        await db.flush()

    try:
        # --- Simulated charge: always succeeds in this mock ---

        wallet = await _get_or_create_wallet(db, ride.driver_id)
        await _credit_wallet(
            db,
            wallet,
            fare.driver_earnings,
            description=f"Earnings for ride {ride.id}",
            reference_id=payment.id,
        )

        payment.status = PaymentStatus.completed
        payment.completed_at = _now()
        ride.fare_ils = float(fare.total_amount)  # denorm for quick read
        payments_processed_total.labels(status="completed").inc()
        revenue_total.inc(int(fare.platform_fee * 100))

    except Exception as exc:  # noqa: BLE001
        payment.status = PaymentStatus.failed
        payment.failure_reason = str(exc)[:255]
        payments_processed_total.labels(status="failed").inc()

    await db.commit()
    await db.refresh(payment)
    return payment


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

async def get_payment_for_ride(db: AsyncSession, ride_id: uuid.UUID) -> RidePayment:
    result = await db.execute(
        select(RidePayment).where(RidePayment.ride_id == ride_id)
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No payment record for this ride",
        )
    return payment


async def get_fare_estimate(db: AsyncSession, ride_id: uuid.UUID) -> FareEstimate:
    ride = await db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")
    return calculate_fare(ride)


async def get_driver_wallet(db: AsyncSession, driver_id: uuid.UUID) -> DriverWallet:
    result = await db.execute(
        select(DriverWallet).where(DriverWallet.driver_id == driver_id)
    )
    wallet = result.scalar_one_or_none()
    if wallet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found — no completed rides yet",
        )
    return wallet


async def get_wallet_entries(
    db: AsyncSession, wallet_id: uuid.UUID, limit: int = 50
) -> list[WalletEntry]:
    result = await db.execute(
        select(WalletEntry)
        .where(WalletEntry.wallet_id == wallet_id)
        .order_by(WalletEntry.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())

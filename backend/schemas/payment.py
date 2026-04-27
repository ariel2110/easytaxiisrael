import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from models.payment import PaymentStatus, WalletEntryType


class FareEstimate(BaseModel):
    distance_km: Decimal
    total_amount: Decimal
    platform_fee: Decimal
    tax_amount: Decimal
    driver_earnings: Decimal


class RidePaymentRead(BaseModel):
    id: uuid.UUID
    ride_id: uuid.UUID
    passenger_id: uuid.UUID
    driver_id: uuid.UUID
    distance_km: Decimal
    total_amount: Decimal
    platform_fee: Decimal
    tax_amount: Decimal
    driver_earnings: Decimal
    status: PaymentStatus
    failure_reason: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class DriverWalletRead(BaseModel):
    id: uuid.UUID
    driver_id: uuid.UUID
    balance: Decimal
    updated_at: datetime

    model_config = {"from_attributes": True}


class WalletEntryRead(BaseModel):
    id: uuid.UUID
    wallet_id: uuid.UUID
    entry_type: WalletEntryType
    amount: Decimal
    balance_after: Decimal
    description: str | None
    reference_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}

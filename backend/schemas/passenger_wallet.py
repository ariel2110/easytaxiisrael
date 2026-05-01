"""Pydantic schemas for the passenger wallet API."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, field_validator

from models.passenger_wallet import PassengerWalletEntryType, PaymentProfile


class PassengerWalletRead(BaseModel):
    id: uuid.UUID
    passenger_id: uuid.UUID
    balance: Decimal
    updated_at: datetime

    model_config = {"from_attributes": True}


class PassengerWalletEntryRead(BaseModel):
    id: uuid.UUID
    wallet_id: uuid.UUID
    entry_type: PassengerWalletEntryType
    amount: Decimal
    balance_after: Decimal
    description: str | None
    ride_id: uuid.UUID | None
    grow_transaction_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletTopUpRequest(BaseModel):
    amount_ils: Decimal
    payment_method_id: uuid.UUID   # which saved card to charge

    @field_validator("amount_ils")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        if v > Decimal("5000"):
            raise ValueError("Maximum top-up ₪5,000 per transaction")
        return v


class PassengerPaymentMethodRead(BaseModel):
    id: uuid.UUID
    card_last4: str
    card_brand: str
    card_expiry: str | None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AddPaymentMethodRequest(BaseModel):
    """
    Client sends the Grow.js token. We store only the token + masked card info.
    Raw card numbers must NEVER be sent to our server.
    """
    grow_token: str
    card_last4: str
    card_brand: str
    card_expiry: str | None = None


class PaymentProfileRead(BaseModel):
    payment_profile: PaymentProfile
    business_name: str | None
    business_tax_id: str | None
    business_email: str | None


class UpdatePaymentProfileRequest(BaseModel):
    payment_profile: PaymentProfile
    business_name: str | None = None
    business_tax_id: str | None = None
    business_email: str | None = None


class WalletWithHistory(BaseModel):
    wallet: PassengerWalletRead
    entries: list[PassengerWalletEntryRead]
    payment_profile: PaymentProfileRead

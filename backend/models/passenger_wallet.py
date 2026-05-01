"""
Passenger wallet models.

PassengerWallet      — one per passenger, tracks prepaid balance
PassengerWalletEntry — immutable ledger (every credit/debit)
PassengerPaymentMethod — saved cards (Grow tokens, never raw PAN)
PaymentProfile       — personal / business toggle on User
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Numeric, String, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base
from security.encryption import EncryptedString

_MONEY = Numeric(12, 2)


class PaymentProfile(str, enum.Enum):
    personal = "personal"   # charged to saved card / wallet
    business = "business"   # auto-invoice to company


class PassengerWalletEntryType(str, enum.Enum):
    credit = "credit"   # top-up, refund
    debit  = "debit"    # ride charge, fee


# ---------------------------------------------------------------------------
# One wallet per passenger
# ---------------------------------------------------------------------------

class PassengerWallet(Base):
    __tablename__ = "passenger_wallets"
    __table_args__ = (UniqueConstraint("passenger_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    passenger_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
        index=True,
    )
    balance: Mapped[float] = mapped_column(_MONEY, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# Immutable ledger
# ---------------------------------------------------------------------------

class PassengerWalletEntry(Base):
    __tablename__ = "passenger_wallet_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("passenger_wallets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    entry_type: Mapped[PassengerWalletEntryType] = mapped_column(
        Enum(PassengerWalletEntryType), nullable=False
    )
    amount: Mapped[float] = mapped_column(_MONEY, nullable=False)
    balance_after: Mapped[float] = mapped_column(_MONEY, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Link to ride if this entry was a ride charge/refund
    ride_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rides.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Grow transaction ID for credits via card top-up
    grow_transaction_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ---------------------------------------------------------------------------
# Saved payment methods (Grow tokens — never raw PAN)
# ---------------------------------------------------------------------------

class PassengerPaymentMethod(Base):
    __tablename__ = "passenger_payment_methods"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    passenger_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Grow payment token — stored encrypted, never the raw card number
    grow_token: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    card_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    card_brand: Mapped[str] = mapped_column(String(20), nullable=False)   # visa/mastercard/etc
    card_expiry: Mapped[str | None] = mapped_column(String(7), nullable=True)  # MM/YYYY
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

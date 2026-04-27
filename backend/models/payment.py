import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base

# Use Numeric(12,2) throughout — never Float for money.
_MONEY = Numeric(12, 2)


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    refunded = "refunded"


class WalletEntryType(str, enum.Enum):
    credit = "credit"
    debit = "debit"


# ---------------------------------------------------------------------------
# One payment record per completed ride
# ---------------------------------------------------------------------------

class RidePayment(Base):
    __tablename__ = "ride_payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ride_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rides.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
        index=True,
    )
    passenger_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Amounts
    distance_km: Mapped[float] = mapped_column(_MONEY, nullable=False)
    total_amount: Mapped[float] = mapped_column(_MONEY, nullable=False)
    platform_fee: Mapped[float] = mapped_column(_MONEY, nullable=False)
    tax_amount: Mapped[float] = mapped_column(_MONEY, nullable=False)
    driver_earnings: Mapped[float] = mapped_column(_MONEY, nullable=False)

    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus),
        nullable=False,
        default=PaymentStatus.pending,
        index=True,
    )
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ---------------------------------------------------------------------------
# One wallet per driver
# ---------------------------------------------------------------------------

class DriverWallet(Base):
    __tablename__ = "driver_wallets"
    __table_args__ = (UniqueConstraint("driver_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
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
# Immutable ledger of wallet movements
# ---------------------------------------------------------------------------

class WalletEntry(Base):
    __tablename__ = "wallet_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("driver_wallets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    entry_type: Mapped[WalletEntryType] = mapped_column(
        Enum(WalletEntryType), nullable=False
    )
    amount: Mapped[float] = mapped_column(_MONEY, nullable=False)
    # Balance snapshot after this entry for easy auditing
    balance_after: Mapped[float] = mapped_column(_MONEY, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True  # e.g. RidePayment.id
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base


class RideStatus(str, enum.Enum):
    pending = "pending"          # passenger requested, awaiting driver assignment
    assigned = "assigned"        # driver auto-assigned, awaiting acceptance
    accepted = "accepted"        # driver accepted, awaiting start
    in_progress = "in_progress"  # ride is active
    completed = "completed"      # ride finished successfully
    cancelled = "cancelled"      # rejected or cancelled by either party


class Ride(Base):
    __tablename__ = "rides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Participants
    passenger_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    driver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # State
    status: Mapped[RideStatus] = mapped_column(
        Enum(RideStatus), nullable=False, default=RideStatus.pending, index=True
    )
    cancellation_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Location
    pickup_lat: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_lng: Mapped[float] = mapped_column(Float, nullable=False)
    dropoff_lat: Mapped[float] = mapped_column(Float, nullable=False)
    dropoff_lng: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dropoff_address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    assigned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Fare — populated by payment service after ride completes
    fare_ils: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Relationships (lazy="raise" prevents accidental sync I/O)
    passenger = relationship(
        "User", foreign_keys=[passenger_id], lazy="raise"
    )
    driver = relationship(
        "User", foreign_keys=[driver_id], lazy="raise"
    )

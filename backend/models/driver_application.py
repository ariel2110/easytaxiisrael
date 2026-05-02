"""
DriverApplication — tracks a passenger's request to become a rideshare driver.

A passenger submits an application, which triggers:
  1. Sumsub KYC (driving_license + selfie)
  2. WhatsApp document collection (insurance, police_clearance, vehicle_registration)
  3. AI review (Agent 2)
  4. Admin approval → user.role = driver, user.auth_status = approved

For now the applicable law is Israel's pending rideshare regulation
(חוק שירות שיתוף נסיעות) — drivers may onboard and prepare; rides commence
when the law takes effect.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class DriverApplicationStatus(str, enum.Enum):
    submitted      = "submitted"       # application submitted, not yet verified
    sumsub_pending = "sumsub_pending"  # Sumsub identity verification in progress
    docs_required  = "docs_required"   # Sumsub passed, collecting docs via WhatsApp
    ai_review      = "ai_review"       # AI agents reviewing documents
    pending_admin  = "pending_admin"   # AI approved, waiting for human approval
    approved       = "approved"        # Admin approved — driver role granted
    rejected       = "rejected"        # Rejected (with reason)


class DriverApplication(Base):
    """One row per passenger-to-driver conversion attempt."""
    __tablename__ = "driver_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # driver_type is always "rideshare" for now (not licensed_taxi)
    driver_type: Mapped[str] = mapped_column(String(32), nullable=False, default="rideshare")
    status: Mapped[DriverApplicationStatus] = mapped_column(
        Enum(DriverApplicationStatus, name="driverapplicationstatus"),
        nullable=False,
        default=DriverApplicationStatus.submitted,
        index=True,
    )

    # ── Vehicle info ──────────────────────────────────────────────────────
    has_vehicle: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vehicle_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vehicle_make: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vehicle_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vehicle_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Driver profile ────────────────────────────────────────────────────
    years_driving: Mapped[int | None] = mapped_column(Integer, nullable=True)
    motivation: Mapped[str | None] = mapped_column(Text, nullable=True)   # "למה אתה רוצה להיות נהג?"

    # ── Review fields ─────────────────────────────────────────────────────
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

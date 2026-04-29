import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
# (Date is used for background_check_expiry, taxi_license_expiry)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class DocumentType(str, enum.Enum):
    drivers_license = "drivers_license"
    vehicle_registration = "vehicle_registration"
    vehicle_insurance = "vehicle_insurance"
    background_check = "background_check"
    profile_photo = "profile_photo"
    vehicle_inspection = "vehicle_inspection"


class DocumentStatus(str, enum.Enum):
    pending = "pending"       # uploaded, awaiting admin review
    approved = "approved"     # verified by admin
    rejected = "rejected"     # rejected, driver must re-upload
    expired = "expired"       # past expiry_date


class ComplianceStatus(str, enum.Enum):
    approved = "approved"     # score 80–100, all required docs valid
    warning = "warning"       # score 50–79, some docs expiring soon
    blocked = "blocked"       # score 0–49, missing/expired critical docs


# ---------------------------------------------------------------------------
# Driver document record
# ---------------------------------------------------------------------------

class DriverDocument(Base):
    __tablename__ = "driver_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType), nullable=False, index=True
    )
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), nullable=False, default=DocumentStatus.pending, index=True
    )

    # File reference — store a path/key; actual file lives in object storage
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)

    # Optional expiry date (required for licenses, insurance, inspection, etc.)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


# ---------------------------------------------------------------------------
# Compliance profile — one row per driver, recalculated on every check
# ---------------------------------------------------------------------------

class DriverComplianceProfile(Base):
    __tablename__ = "driver_compliance_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    compliance_status: Mapped[ComplianceStatus] = mapped_column(
        Enum(ComplianceStatus),
        nullable=False,
        default=ComplianceStatus.blocked,
        index=True,
    )
    compliance_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Auto-blocking flag set by the system; admin can manually override
    auto_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    block_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Criminal background check (אישור יושרה) ─────────────────────────
    # Persona cannot automate this for Israel — manual upload + admin review
    background_check_approved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    background_check_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)

    # ── Professional taxi license (רישיון נהיגה לרכב שכור) ───────────────
    # Only required for driver_type == licensed_taxi
    # Verified via Persona PERSONA_TAXI_LICENSE_TEMPLATE_ID or manual upload
    taxi_license_approved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    taxi_license_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)

    last_evaluated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

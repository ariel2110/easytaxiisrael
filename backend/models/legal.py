"""
Legal status model — lightweight boolean-flag view of a driver's compliance.
Complements the detailed models/compliance.py (documents, scoring engine).
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class LegalComplianceStatus(str, enum.Enum):
    approved = "approved"   # score = 100
    warning = "warning"     # score 70–99
    blocked = "blocked"     # score < 70


class DriverLegalStatus(Base):
    """One row per driver — high-level compliance flags and derived score."""

    __tablename__ = "driver_legal_statuses"

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

    # Boolean compliance gates
    license_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    insurance_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vehicle_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    documents_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Derived fields (recalculated on each update)
    compliance_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[LegalComplianceStatus] = mapped_column(
        Enum(LegalComplianceStatus),
        nullable=False,
        default=LegalComplianceStatus.blocked,
        index=True,
    )
    block_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ComplianceStep(Base):
    """Ordered checklist of steps a driver must complete to become approved."""

    __tablename__ = "compliance_steps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_name: Mapped[str] = mapped_column(String(100), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class LegalDocument(Base):
    """Uploaded legal document with mock file path and expiry tracking."""

    __tablename__ = "legal_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_name: Mapped[str] = mapped_column(String(100), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)  # mock/object-store path
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_expired: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

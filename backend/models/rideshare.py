"""
Rideshare (non-licensed taxi) driver models.

Israeli "חוק אובר" (2026) — Ride-sharing law:
  - Passed first reading: March 2026
  - Full implementation: pending secondary legislation from Ministry of Transport
  - While pending: rideshare drivers CANNOT accept payment of any kind
  - Once active: requires 4+ years driving experience, background check, training

Two tables:
  RideshareProfile  — one row per rideshare driver; acknowledgment + status
  RideshareDocument — documents uploaded in preparation for eventual licensing
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RideshareStatus(str, enum.Enum):
    pending_legislation  = "pending_legislation"   # החוק טרם נכנס לתוקף
    documents_pending    = "documents_pending"     # אישר אך לא העלה מסמכים
    documents_submitted  = "documents_submitted"   # מסמכים הוגשו — ממתין לבדיקה
    ready                = "ready"                 # הכל תקין — מוכן להפעלה כשהחוק יאשר


class RideshareDocType(str, enum.Enum):
    drivers_license          = "drivers_license"          # רישיון נהיגה (4+ שנים)
    vehicle_registration     = "vehicle_registration"     # רישיון רכב
    insurance_mandatory      = "insurance_mandatory"      # ביטוח חובה
    insurance_commercial     = "insurance_commercial"     # ביטוח מסחרי
    vehicle_inspection       = "vehicle_inspection"       # טסט רכב
    profile_photo            = "profile_photo"            # תמונת פרופיל
    identity_document        = "identity_document"        # תעודת זהות
    background_check         = "background_check"         # אישור יושר / בדיקת רקע
    training_certificate     = "training_certificate"     # תעודת הכשרה (כשתינתן)
    criminal_record_extract  = "criminal_record_extract"  # תדפיס פלילי


class RideshareDocStatus(str, enum.Enum):
    pending  = "pending"
    approved = "approved"
    rejected = "rejected"


# ---------------------------------------------------------------------------
# Rideshare driver profile — one row per driver who declared rideshare type
# ---------------------------------------------------------------------------

class RideshareProfile(Base):
    __tablename__ = "rideshare_profiles"

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

    # ── Legal acknowledgment ─────────────────────────────────────────────
    # Driver must explicitly confirm they will NOT accept any payment
    # until the law comes into full effect.
    acknowledged_no_payment: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # IP address at time of acknowledgment (for legal record)
    acknowledged_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── Profile status ───────────────────────────────────────────────────
    status: Mapped[RideshareStatus] = mapped_column(
        Enum(RideshareStatus),
        nullable=False,
        default=RideshareStatus.pending_legislation,
        index=True,
    )

    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# Rideshare documents
# ---------------------------------------------------------------------------

class RideshareDocument(Base):
    __tablename__ = "rideshare_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doc_type: Mapped[RideshareDocType] = mapped_column(
        Enum(RideshareDocType), nullable=False, index=True
    )
    status: Mapped[RideshareDocStatus] = mapped_column(
        Enum(RideshareDocStatus),
        nullable=False,
        default=RideshareDocStatus.pending,
        index=True,
    )
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

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

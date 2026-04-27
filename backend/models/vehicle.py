"""
Vehicle compliance model.

Two tables:
  VehiclePhoto      — one row per photo (4 exterior + 2 interior required)
  VehicleCompliance — one row per driver; aggregated compliance state

Israeli law requirements for rideshare (EasyTaxi):
  1. ביטוח חובה תקף          — Mandatory insurance (חוק פיצויים לנפגעי תאונות דרכים)
  2. ביטוח מסחרי / צד ג'     — Commercial / extended third-party insurance
  3. טסט רכב תקף              — Valid roadworthiness certificate (תקנות התעבורה)
  4. רישיון רכב               — Vehicle registration
  5. גיל רכב עד 7 שנים        — Vehicle age ≤ 7 years (Israeli rideshare regulation)
  6. 4 תמונות חיצוניות        — Front / rear / driver-side / passenger-side
  7. 2 תמונות פנים             — Interior front + interior rear
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

class VehiclePhotoType(str, enum.Enum):
    front            = "front"             # חזית הרכב
    rear             = "rear"              # אחורי הרכב
    driver_side      = "driver_side"       # צד נהג
    passenger_side   = "passenger_side"    # צד נוסע
    interior_front   = "interior_front"    # פנים — מושב קדמי / לוח מחוונים
    interior_rear    = "interior_rear"     # פנים — מושב אחורי


class VehiclePhotoStatus(str, enum.Enum):
    pending  = "pending"   # ממתין לבדיקה
    approved = "approved"  # אושר ✅
    rejected = "rejected"  # נדחה — נדרשת תמונה חדשה ❌


class VehicleComplianceStatus(str, enum.Enum):
    pending  = "pending"   # טרם הוגשו כל המסמכים
    approved = "approved"  # כל הבדיקות עברו ✅
    rejected = "rejected"  # אחת הבדיקות נכשלה ❌


# ---------------------------------------------------------------------------
# Vehicle photos — 6 required (4 exterior + 2 interior)
# ---------------------------------------------------------------------------

class VehiclePhoto(Base):
    __tablename__ = "vehicle_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    photo_type: Mapped[VehiclePhotoType] = mapped_column(
        Enum(VehiclePhotoType), nullable=False, index=True
    )
    status: Mapped[VehiclePhotoStatus] = mapped_column(
        Enum(VehiclePhotoStatus),
        nullable=False,
        default=VehiclePhotoStatus.pending,
        index=True,
    )
    # file_key: path / S3 key of the uploaded image
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


# ---------------------------------------------------------------------------
# Vehicle compliance profile — one row per driver
# ---------------------------------------------------------------------------

class VehicleCompliance(Base):
    __tablename__ = "vehicle_compliance"

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

    # ── Israeli law compliance flags ──────────────────────────────────────
    insurance_mandatory_valid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # ביטוח חובה
    insurance_commercial_valid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # ביטוח מסחרי / צד ג' מורחב
    vehicle_test_valid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # טסט רכב
    registration_valid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # רישיון רכב
    vehicle_age_ok: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # גיל רכב ≤ 7 שנים
    photos_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # כל 6 התמונות הוגשו ואושרו

    # ── Overall status ────────────────────────────────────────────────────
    status: Mapped[VehicleComplianceStatus] = mapped_column(
        Enum(VehicleComplianceStatus),
        nullable=False,
        default=VehicleComplianceStatus.pending,
        index=True,
    )

    # Persona vehicle-inquiry ID that triggered last status change
    persona_inquiry_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )

    rejection_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

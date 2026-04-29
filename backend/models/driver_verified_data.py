"""
Driver verified data model.

Stores the identity fields extracted from Persona after an inquiry.approved event.
One row per approved inquiry — a driver may have multiple rows over time as they
re-verify. The LATEST row is the canonical source of truth.

Fields come from Persona's `verification/government-id` and `verification/selfie`
verifications embedded in the approved inquiry.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class DriverVerifiedData(Base):
    __tablename__ = "driver_verified_data"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    persona_inquiry_id: Mapped[str] = mapped_column(
        String(128), nullable=False, index=True
    )

    # ── Identity fields (from verification/government-id) ─────────────────
    verified_name_first: Mapped[str | None] = mapped_column(String(120), nullable=True)
    verified_name_last: Mapped[str | None] = mapped_column(String(120), nullable=True)
    id_number: Mapped[str | None] = mapped_column(String(64), nullable=True)   # Israeli ID / Passport number
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    issuing_country: Mapped[str | None] = mapped_column(String(8), nullable=True)   # "IL" expected
    gov_id_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    gov_id_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Driver's license fields (from verification/government-id, doc type = driver_license) ──
    license_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    license_class: Mapped[str | None] = mapped_column(String(32), nullable=True)  # "B", "B+E", "C" etc.
    license_expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # ⚠️ Critical — used for expiry monitoring
    license_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Selfie / liveness (from verification/selfie) ──────────────────────
    selfie_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Raw response for full audit trail ────────────────────────────────
    raw_persona_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string

    verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

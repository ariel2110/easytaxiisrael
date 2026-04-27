"""
Persona KYC inquiry model.

Each row tracks one identity-verification inquiry sent to Persona.
A driver may have multiple inquiries over time (e.g. re-verification).
The *latest* approved inquiry is what grants compliance clearance.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class PersonaInquiryStatus(str, enum.Enum):
    created   = "created"     # inquiry object exists, flow not started
    started   = "started"     # driver opened the flow
    completed = "completed"   # driver finished steps, awaiting decision
    approved  = "approved"    # KYC passed ✅
    declined  = "declined"    # KYC failed ❌
    expired   = "expired"     # inquiry TTL reached without completion


class PersonaInquiry(Base):
    __tablename__ = "persona_inquiries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The "inq_xxx" ID assigned by Persona
    persona_inquiry_id: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )

    status: Mapped[PersonaInquiryStatus] = mapped_column(
        Enum(PersonaInquiryStatus),
        nullable=False,
        default=PersonaInquiryStatus.created,
        index=True,
    )

    # Short-lived session token used to resume / launch the hosted flow
    session_token: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Which template was used (e.g. "tmpl_xxx")
    template_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

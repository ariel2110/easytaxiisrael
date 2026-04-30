"""
Sumsub applicant model — tracks one verification session per driver per level.
"""
import enum
import json
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class SumsubStatus(str, enum.Enum):
    init      = "init"       # applicant created, token not yet used
    pending   = "pending"    # documents submitted, under review
    completed = "completed"  # approved GREEN ✅
    rejected  = "rejected"   # rejected RED ❌
    on_hold   = "on_hold"    # manual review requested


class SumsubApplicant(Base):
    __tablename__ = "sumsub_applicants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sumsub_applicant_id: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    level_name: Mapped[str] = mapped_column(
        String(64), nullable=False
    )
    status: Mapped[SumsubStatus] = mapped_column(
        Enum(SumsubStatus, name="sumsubstatus"),
        nullable=False,
        default=SumsubStatus.init,
        index=True,
    )
    review_result: Mapped[str | None] = mapped_column(String(16), nullable=True)   # GREEN | RED
    reject_labels: Mapped[str | None] = mapped_column(Text, nullable=True)          # JSON list

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

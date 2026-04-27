"""
Audit log model — append-only record of security-relevant events.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class AuditAction(str, enum.Enum):
    # Auth
    login = "login"
    logout = "logout"
    token_refresh = "token_refresh"
    otp_requested = "otp_requested"
    otp_verified = "otp_verified"

    # Rides
    ride_requested = "ride_requested"
    ride_accepted = "ride_accepted"
    ride_rejected = "ride_rejected"
    ride_started = "ride_started"
    ride_ended = "ride_ended"
    ride_cancelled = "ride_cancelled"

    # Payments
    payment_processed = "payment_processed"
    payment_failed = "payment_failed"

    # Admin
    admin_review_document = "admin_review_document"
    admin_evaluate_driver = "admin_evaluate_driver"
    admin_expiry_sweep = "admin_expiry_sweep"
    admin_flag_update = "admin_flag_update"

    # Security
    rate_limit_exceeded = "rate_limit_exceeded"
    unauthorized_access = "unauthorized_access"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True  # None for unauthenticated events
    )
    action: Mapped[AuditAction] = mapped_column(
        Enum(AuditAction), nullable=False, index=True
    )
    resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

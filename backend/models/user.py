import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base
from security.encryption import EncryptedString


class UserRole(str, enum.Enum):
    driver = "driver"
    passenger = "passenger"
    admin = "admin"


class DriverType(str, enum.Enum):
    licensed_taxi = "licensed_taxi"   # נהג מונית מורשה — רישיון D בתוקף
    rideshare     = "rideshare"       # נהג שיתופי (הובר/אובר) — ממתין לחקיקה


class AuthStatus(str, enum.Enum):
    pending             = "pending"              # נרשם, טרם אימת
    whatsapp_verified   = "whatsapp_verified"    # אימת ב-WhatsApp
    persona_in_progress = "persona_in_progress"  # KYC בתהליך (legacy)
    docs_collecting     = "docs_collecting"      # Sumsub ✅ — מעלה מסמכים נוספים ב-WhatsApp
    persona_completed   = "persona_completed"    # כל המסמכים אושרו — ממתין לאישור ידני
    approved            = "approved"             # מאושר לחלוטין
    blocked             = "blocked"              # נחסם — נדחה על ידי Sumsub / סוכן AI


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        # Used by _find_available_driver() and compliance queries — avoids full table scan
        Index("ix_users_role_is_active", "role", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    phone: Mapped[str] = mapped_column(
        EncryptedString, unique=True, nullable=False, index=True
    )
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    # For drivers only: licensed_taxi (מונית מורשה) or rideshare (הובר/אובר)
    driver_type: Mapped[DriverType | None] = mapped_column(
        Enum(DriverType), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Auth status — tracks the verification pipeline stage
    auth_status: Mapped[AuthStatus] = mapped_column(
        Enum(AuthStatus), nullable=False, default=AuthStatus.pending, index=True
    )
    # Deduplication: store Evolution API message ID of last processed auth message
    last_wa_msg_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Profile fields — collected during onboarding wizard
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    # Driver vehicle registration plate — verified against data.gov.il
    vehicle_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Payment profile — personal or business (affects invoice generation)
    payment_profile: Mapped[str] = mapped_column(String(20), nullable=False, default="personal")
    # Business profile details (used when payment_profile == "business")
    business_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    business_tax_id: Mapped[str | None] = mapped_column(String(20), nullable=True)   # ח.פ / ע.מ
    business_email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    # FCM / APNs device token — updated by client on login
    device_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Terms of Service acceptance timestamp — required before first ride
    tos_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

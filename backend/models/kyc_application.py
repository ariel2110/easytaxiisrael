"""
KYC Application model — replaces Persona.com integration.

Two driver types have different document requirements per Israeli law:
  - rideshare       (נהג שיתופי):  gov_id, driving_license, vehicle_registration,
                                    vehicle_insurance, police_clearance, selfie
  - licensed_taxi   (נהג מונית):   above + professional_license, taxi_badge,
                                    vehicle_inspection, medical_clearance

Verification uses two AI agents sequentially:
  Agent 1 (GPT-4o Vision)  — extracts data from each document image
  Agent 2 (Claude Sonnet)  — cross-validates all docs, applies Israeli law rules
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey,
    Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class KYCDocumentType(str, enum.Enum):
    # Required for ALL drivers
    govt_id             = "govt_id"             # תעודת זהות ישראלית / דרכון
    driving_license     = "driving_license"     # רישיון נהיגה B/D
    vehicle_registration= "vehicle_registration"# רישיון רכב (רישוי)
    vehicle_insurance   = "vehicle_insurance"   # ביטוח כולל הסעת נוסעים בשכר
    police_clearance    = "police_clearance"    # אישור יושרה ממשטרה
    selfie              = "selfie"              # תמונת פנים (liveness)
    # Required for licensed_taxi ONLY
    professional_license= "professional_license"# רישיון נהג מקצועי D
    taxi_badge          = "taxi_badge"          # רישיון מונית / "טאבו"
    vehicle_inspection  = "vehicle_inspection"  # טסט תקופתי
    medical_clearance   = "medical_clearance"   # אישור רופא מוסמך


class KYCApplicationStatus(str, enum.Enum):
    draft        = "draft"         # נפתח, עדיין לא הוגש
    submitted    = "submitted"     # כל המסמכים הועלו, ממתין לסוכנים
    processing   = "processing"    # סוכנים רצים
    needs_review = "needs_review"  # סוכנים לא הסכימו — נדרשת בדיקה אנושית
    approved     = "approved"      # שני הסוכנים אישרו
    rejected     = "rejected"      # נדחה (עם סיבות)
    resubmit     = "resubmit"      # נדרש העלאה מחדש של מסמך ספציפי


class KYCDocumentStatus(str, enum.Enum):
    pending    = "pending"    # הועלה, ממתין לניתוח
    analysed   = "analysed"   # Agent 1 ניתח
    approved   = "approved"   # תקין
    rejected   = "rejected"   # בעיה במסמך


class KYCApplication(Base):
    """One row per driver KYC attempt."""
    __tablename__ = "kyc_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    driver_type: Mapped[str] = mapped_column(
        String(32), nullable=False  # "rideshare" | "licensed_taxi"
    )
    status: Mapped[KYCApplicationStatus] = mapped_column(
        Enum(KYCApplicationStatus, name="kycapplicationstatus"),
        nullable=False,
        default=KYCApplicationStatus.draft,
        index=True,
    )

    # ── Agent 1 result (GPT-4o Vision — document extraction) ──────────────
    agent1_result: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    agent1_verdict: Mapped[str | None] = mapped_column(String(16), nullable=True)  # "approve"|"reject"|"manual"
    agent1_model: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── Agent 2 result (Claude — Israeli law compliance review) ───────────
    agent2_result: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    agent2_verdict: Mapped[str | None] = mapped_column(String(16), nullable=True)
    agent2_model: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── Final decision ─────────────────────────────────────────────────────
    final_verdict: Mapped[str | None] = mapped_column(String(16), nullable=True)
    rejection_reasons: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # ── Extracted identity fields (populated after Agent 1 approval) ──────
    verified_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    id_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    date_of_birth: Mapped[str | None] = mapped_column(String(16), nullable=True)  # YYYY-MM-DD
    license_class: Mapped[str | None] = mapped_column(String(16), nullable=True)
    license_expiry: Mapped[str | None] = mapped_column(String(16), nullable=True)
    insurance_covers_rideshare: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Compliance score (0-100) calculated by Agent 2 ────────────────────
    compliance_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class KYCDocument(Base):
    """One row per uploaded document within a KYC application."""
    __tablename__ = "kyc_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("kyc_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_type: Mapped[KYCDocumentType] = mapped_column(
        Enum(KYCDocumentType, name="kycdocumenttype"),
        nullable=False,
    )
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[KYCDocumentStatus] = mapped_column(
        Enum(KYCDocumentStatus, name="kycdocumentstatus"),
        nullable=False,
        default=KYCDocumentStatus.pending,
    )

    # Agent 1 extraction result for this specific document
    agent1_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    agent1_issues: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    agent1_confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-100

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

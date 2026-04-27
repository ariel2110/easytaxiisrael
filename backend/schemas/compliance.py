import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from models.compliance import ComplianceStatus, DocumentStatus, DocumentType


# ---------------------------------------------------------------------------
# Document request / response
# ---------------------------------------------------------------------------

class DocumentUpload(BaseModel):
    document_type: DocumentType
    file_key: str = Field(..., max_length=512, description="Object-storage key for the file")
    expiry_date: date | None = None
    notes: str | None = Field(None, max_length=1000)


class DocumentReview(BaseModel):
    status: DocumentStatus = Field(
        ..., description="New status: approved or rejected"
    )
    rejection_reason: str | None = Field(None, max_length=1000)
    notes: str | None = Field(None, max_length=1000)


class DocumentRead(BaseModel):
    id: uuid.UUID
    driver_id: uuid.UUID
    document_type: DocumentType
    status: DocumentStatus
    file_key: str
    expiry_date: date | None
    rejection_reason: str | None
    notes: str | None
    uploaded_at: datetime
    reviewed_at: datetime | None
    reviewed_by: uuid.UUID | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Compliance profile response
# ---------------------------------------------------------------------------

class DocumentSummary(BaseModel):
    document_type: DocumentType
    status: DocumentStatus
    expiry_date: date | None
    days_until_expiry: int | None   # None if no expiry; negative = already expired


class ComplianceProfileRead(BaseModel):
    driver_id: uuid.UUID
    compliance_status: ComplianceStatus
    compliance_score: int            # 0–100
    auto_blocked: bool
    block_reason: str | None
    last_evaluated_at: datetime | None
    documents: list[DocumentSummary]
    missing_required: list[DocumentType]
    progress_pct: int                # 0–100 (% of required docs submitted/approved)

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Admin bulk evaluation response
# ---------------------------------------------------------------------------

class ComplianceEvaluationResult(BaseModel):
    driver_id: uuid.UUID
    previous_status: ComplianceStatus
    new_status: ComplianceStatus
    score: int
    auto_blocked: bool
    changes: list[str]               # human-readable change log

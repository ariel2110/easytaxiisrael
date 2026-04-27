import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from models.legal import LegalComplianceStatus


class LegalDocumentUpload(BaseModel):
    document_name: str = Field(..., max_length=100)
    file_path: str = Field(..., max_length=512, description="Mock file path or object-store key")
    expiry_date: date | None = None


class LegalDocumentRead(BaseModel):
    id: uuid.UUID
    driver_id: uuid.UUID
    document_name: str
    file_path: str
    expiry_date: date | None
    is_expired: bool
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class ComplianceStepRead(BaseModel):
    id: uuid.UUID
    step_name: str
    step_order: int
    completed: bool
    completed_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}


class DriverLegalStatusRead(BaseModel):
    driver_id: uuid.UUID
    license_valid: bool
    insurance_valid: bool
    vehicle_valid: bool
    documents_verified: bool
    compliance_score: int
    status: LegalComplianceStatus
    block_reason: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComplianceProgressRead(BaseModel):
    driver_id: uuid.UUID
    compliance_score: int
    status: LegalComplianceStatus
    progress_pct: int          # % of steps completed
    steps_completed: int
    steps_total: int
    steps: list[ComplianceStepRead]
    pending_documents: int
    expired_documents: int

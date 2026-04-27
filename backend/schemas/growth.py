import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from models.growth import CampaignStatus, LeadSource, LeadStatus


# ---- Lead schemas ----

class LeadCreate(BaseModel):
    phone: str
    name: str | None = None
    source: LeadSource = LeadSource.organic
    notes: str | None = None

    @field_validator("phone")
    @classmethod
    def phone_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("phone must not be empty")
        return v


class LeadUpdate(BaseModel):
    name: str | None = None
    status: LeadStatus | None = None
    notes: str | None = None


class LeadRead(BaseModel):
    id: uuid.UUID
    phone: str
    name: str | None
    source: LeadSource
    status: LeadStatus
    campaign_id: uuid.UUID | None
    notes: str | None
    converted_at: datetime | None
    last_contacted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Campaign schemas ----

class CampaignCreate(BaseModel):
    name: str
    message_template: str


class CampaignRead(BaseModel):
    id: uuid.UUID
    name: str
    message_template: str
    status: CampaignStatus
    target_count: int
    sent_count: int
    conversion_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Message send ----

class SendMessageRequest(BaseModel):
    lead_ids: list[uuid.UUID]
    message: str | None = None         # optional override; AI-generated if omitted
    campaign_id: uuid.UUID | None = None


class SendMessageResponse(BaseModel):
    sent: int
    failed: int
    details: list[dict]

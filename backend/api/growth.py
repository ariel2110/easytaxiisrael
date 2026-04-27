import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import require_roles
from models.growth import LeadStatus
from models.user import User, UserRole
from schemas.growth import (
    CampaignCreate,
    CampaignRead,
    LeadCreate,
    LeadRead,
    LeadUpdate,
    SendMessageRequest,
    SendMessageResponse,
)
from services import growth as growth_service

router = APIRouter(prefix="/growth", tags=["growth"])

_admin = require_roles(UserRole.admin)


@router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
) -> LeadRead:
    return await growth_service.create_lead(db, payload)


@router.get("/leads", response_model=list[LeadRead])
async def list_leads(
    lead_status: LeadStatus | None = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
) -> list[LeadRead]:
    return await growth_service.list_leads(db, lead_status, limit, offset)


@router.patch("/leads/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
) -> LeadRead:
    return await growth_service.update_lead(db, lead_id, payload)


@router.post("/campaigns", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
) -> CampaignRead:
    return await growth_service.create_campaign(db, payload)


@router.get("/campaigns", response_model=list[CampaignRead])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
) -> list[CampaignRead]:
    return await growth_service.list_campaigns(db)


@router.post("/campaigns/{campaign_id}/activate", response_model=CampaignRead)
async def activate_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
) -> CampaignRead:
    return await growth_service.activate_campaign(db, campaign_id)


@router.post("/send-message", response_model=SendMessageResponse)
async def send_message(
    req: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
) -> SendMessageResponse:
    return await growth_service.send_messages(db, req)

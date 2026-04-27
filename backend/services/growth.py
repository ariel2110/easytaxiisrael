"""
Growth service.

Responsibilities
----------------
1. Lead CRUD with deduplication
2. Campaign management
3. AI message generation (template-based heuristic — no external LLM dep)
4. WhatsApp mock sender (logs to console, no real API call)
5. Response classification
6. Conversion tracker
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.growth import Campaign, CampaignStatus, Lead, LeadSource, LeadStatus
from services import whatsapp as whatsapp_svc
from schemas.growth import (
    CampaignCreate,
    LeadCreate,
    LeadUpdate,
    SendMessageRequest,
    SendMessageResponse,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# AI message generation (heuristic — no external API)
# ---------------------------------------------------------------------------

_TEMPLATES = {
    "welcome": (
        "Hi {name}! 👋 Welcome to RideOS — the fastest rides in town. "
        "Download the app and get your first ride at 20% off with code FIRST20. "
        "Reply STOP to unsubscribe."
    ),
    "reactivation": (
        "Hey {name}, we miss you! 🚗 It's been a while since your last RideOS ride. "
        "Come back today and enjoy a $3 discount on your next trip. "
        "Reply STOP to opt out."
    ),
    "surge_offer": (
        "Hi {name}! Demand is high right now, but we've locked in a flat rate for you. "
        "Book within the next hour and pay no surge. 🎉 Reply STOP to unsubscribe."
    ),
    "driver_recruitment": (
        "Hi {name}! Earn $1,000+ per week driving with RideOS. "
        "Flexible hours, instant payouts. Sign up at rideos.app/drive — takes 5 mins! "
        "Reply STOP to opt out."
    ),
    "default": (
        "Hi {name}! 🚀 RideOS — affordable rides, anytime. "
        "Book your first ride today and use code WELCOME for a discount. "
        "Reply STOP to unsubscribe."
    ),
}


def _classify_intent(message: str) -> str:
    """Very simple keyword-based intent classifier."""
    lower = message.lower()
    if any(w in lower for w in ("drive", "driver", "earn", "income")):
        return "driver_recruitment"
    if any(w in lower for w in ("back", "miss", "again", "return")):
        return "reactivation"
    if any(w in lower for w in ("surge", "peak", "busy")):
        return "surge_offer"
    if any(w in lower for w in ("welcome", "new", "first", "join")):
        return "welcome"
    return "default"


def generate_message(name: str | None, intent: str | None = None) -> str:
    display = name or "there"
    key = intent or "default"
    template = _TEMPLATES.get(key, _TEMPLATES["default"])
    return template.format(name=display)


# ---------------------------------------------------------------------------
# WhatsApp mock sender
# ---------------------------------------------------------------------------

async def _send_whatsapp(phone: str, message: str) -> bool:
    """Send a WhatsApp message via Evolution API."""
    return await whatsapp_svc.send_text(phone, message)


# ---------------------------------------------------------------------------
# Lead CRUD
# ---------------------------------------------------------------------------

async def create_lead(db: AsyncSession, payload: LeadCreate) -> Lead:
    existing = await db.execute(select(Lead).where(Lead.phone == payload.phone))
    if existing.scalar_one_or_none():
        raise ValueError(f"Lead with phone {payload.phone} already exists")
    lead = Lead(**payload.model_dump())
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


async def list_leads(
    db: AsyncSession,
    status: LeadStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Lead]:
    q = select(Lead).order_by(Lead.created_at.desc()).limit(limit).offset(offset)
    if status:
        q = q.where(Lead.status == status)
    result = await db.execute(q)
    return list(result.scalars().all())


async def update_lead(db: AsyncSession, lead_id: uuid.UUID, payload: LeadUpdate) -> Lead:
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise ValueError("Lead not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(lead, k, v)
    if payload.status == LeadStatus.converted and not lead.converted_at:
        lead.converted_at = datetime.now(timezone.utc)
        # Increment campaign conversion count
        if lead.campaign_id:
            campaign = await db.get(Campaign, lead.campaign_id)
            if campaign:
                campaign.conversion_count += 1
    await db.commit()
    await db.refresh(lead)
    return lead


# ---------------------------------------------------------------------------
# Campaign CRUD
# ---------------------------------------------------------------------------

async def create_campaign(db: AsyncSession, payload: CampaignCreate) -> Campaign:
    campaign = Campaign(**payload.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def list_campaigns(db: AsyncSession) -> list[Campaign]:
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return list(result.scalars().all())


async def activate_campaign(db: AsyncSession, campaign_id: uuid.UUID) -> Campaign:
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError("Campaign not found")
    campaign.status = CampaignStatus.active
    await db.commit()
    await db.refresh(campaign)
    return campaign


# ---------------------------------------------------------------------------
# Messaging
# ---------------------------------------------------------------------------

async def send_messages(
    db: AsyncSession, req: SendMessageRequest
) -> SendMessageResponse:
    sent = 0
    failed = 0
    details: list[dict] = []

    # Fetch leads
    leads_result = await db.execute(select(Lead).where(Lead.id.in_(req.lead_ids)))
    leads = list(leads_result.scalars().all())

    now = datetime.now(timezone.utc)

    for lead in leads:
        # Determine message
        if req.message:
            msg = req.message
        else:
            intent = _classify_intent(req.campaign_id and "" or "default")
            msg = generate_message(lead.name, intent)

        ok = await _send_whatsapp(lead.phone, msg)
        if ok:
            sent += 1
            lead.status = LeadStatus.contacted
            lead.last_contacted_at = now
            if req.campaign_id:
                lead.campaign_id = req.campaign_id
            details.append({"lead_id": str(lead.id), "phone": lead.phone, "status": "sent"})
        else:
            failed += 1
            details.append({"lead_id": str(lead.id), "phone": lead.phone, "status": "failed"})

    # Update campaign sent count
    if req.campaign_id:
        campaign = await db.get(Campaign, req.campaign_id)
        if campaign:
            campaign.sent_count += sent
            campaign.target_count = max(campaign.target_count, len(leads))

    await db.commit()
    return SendMessageResponse(sent=sent, failed=failed, details=details)


async def send_pending_campaign_messages(db: AsyncSession) -> int:
    """
    Background-worker entry point.

    Sends messages to all leads that belong to active campaigns
    but have not yet been contacted.  Returns total sent count.
    """
    from models.growth import CampaignStatus, LeadStatus

    active_campaigns_result = await db.execute(
        select(Campaign).where(Campaign.status == CampaignStatus.active)
    )
    active_campaigns = list(active_campaigns_result.scalars().all())

    total_sent = 0
    now = datetime.now(timezone.utc)

    for campaign in active_campaigns:
        pending_leads_result = await db.execute(
            select(Lead).where(
                Lead.campaign_id == campaign.id,
                Lead.status == LeadStatus.new,
            ).limit(50)  # batch cap — prevents unbounded send in one cron tick
        )
        leads = list(pending_leads_result.scalars().all())

        for lead in leads:
            msg = generate_message(lead.name)
            ok = await _send_whatsapp(lead.phone, msg)
            if ok:
                lead.status = LeadStatus.contacted
                lead.last_contacted_at = now
                campaign.sent_count += 1
                total_sent += 1

    await db.commit()
    return total_sent

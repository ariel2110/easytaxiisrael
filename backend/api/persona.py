"""
Persona KYC API routes.

Endpoints:
  POST /persona/inquiry          — Driver starts KYC → returns Persona hosted-flow URL
  GET  /persona/inquiry/status   — Driver checks own KYC status
  POST /persona/webhook          — Persona event callback (signature-verified)
  GET  /admin/persona/{driver_id}— Admin: view any driver's KYC history
"""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.persona import PersonaInquiry, PersonaInquiryStatus
from models.user import User, UserRole
from services import persona as persona_svc

router = APIRouter(prefix="/persona", tags=["persona"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class InquiryStartResponse(BaseModel):
    inquiry_id: str
    persona_inquiry_id: str
    status: PersonaInquiryStatus
    hosted_flow_url: str | None  # None if session token unavailable


class InquiryStatusResponse(BaseModel):
    persona_inquiry_id: str | None
    status: PersonaInquiryStatus | None
    hosted_flow_url: str | None


class PersonaInquiryRead(BaseModel):
    id: uuid.UUID
    driver_id: uuid.UUID
    persona_inquiry_id: str
    status: PersonaInquiryStatus
    template_id: str
    hosted_flow_url: str | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hosted_flow_url(inquiry: PersonaInquiry) -> str | None:
    if not inquiry.session_token:
        return None
    return (
        f"https://withpersona.com/verify"
        f"?inquiry-id={inquiry.persona_inquiry_id}"
        f"&session-token={inquiry.session_token}"
    )


# ---------------------------------------------------------------------------
# Driver routes
# ---------------------------------------------------------------------------

@router.post(
    "/inquiry",
    response_model=InquiryStartResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a Persona KYC inquiry (driver)",
)
async def start_inquiry(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> InquiryStartResponse:
    """
    Create a new Persona identity-verification inquiry for the authenticated driver.
    Returns a `hosted_flow_url` that the frontend should redirect the driver to.
    """
    inquiry = await persona_svc.create_inquiry(db, current_user.id)
    return InquiryStartResponse(
        inquiry_id=str(inquiry.id),
        persona_inquiry_id=inquiry.persona_inquiry_id,
        status=inquiry.status,
        hosted_flow_url=_hosted_flow_url(inquiry),
    )


@router.get(
    "/inquiry/status",
    response_model=InquiryStatusResponse,
    summary="Get own KYC inquiry status (driver)",
)
async def get_inquiry_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> InquiryStatusResponse:
    """Return the latest KYC inquiry status for the authenticated driver."""
    inquiry = await persona_svc.get_latest_inquiry(db, current_user.id)
    if inquiry is None:
        return InquiryStatusResponse(
            persona_inquiry_id=None,
            status=None,
            hosted_flow_url=None,
        )
    return InquiryStatusResponse(
        persona_inquiry_id=inquiry.persona_inquiry_id,
        status=inquiry.status,
        hosted_flow_url=_hosted_flow_url(inquiry),
    )


# ---------------------------------------------------------------------------
# Persona webhook (no JWT — authenticated by signature)
# ---------------------------------------------------------------------------

@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Persona webhook receiver",
    include_in_schema=False,  # hide from public docs
)
async def persona_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Receive events from Persona (inquiry.approved, inquiry.declined, etc.).

    Security:
    - If PERSONA_WEBHOOK_SECRET is configured, the request signature is verified.
    - Always returns 200 so Persona does not retry on processing errors.
    """
    raw_body = await request.body()

    # Verify signature when secret is configured
    if settings.PERSONA_WEBHOOK_SECRET:
        sig_header = request.headers.get("persona-signature", "")
        if not persona_svc.verify_webhook_signature(
            raw_body, sig_header, settings.PERSONA_WEBHOOK_SECRET
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Persona webhook signature",
            )

    try:
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, ValueError):
        # Return 200 to prevent infinite Persona retries
        return {"received": True, "error": "invalid_json"}

    data = payload.get("data", {})
    attrs = data.get("attributes", {})
    event_name: str = attrs.get("name", "")
    inquiry_data = attrs.get("payload", {}).get("data", {})
    persona_inquiry_id: str = inquiry_data.get("id", "")

    if event_name and persona_inquiry_id:
        await persona_svc.handle_webhook_event(db, event_name, persona_inquiry_id)

    return {"received": True}


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------

@router.get(
    "/admin/drivers/{driver_id}/inquiries",
    response_model=list[PersonaInquiryRead],
    summary="[Admin] List all KYC inquiries for a driver",
)
async def admin_list_inquiries(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[PersonaInquiryRead]:
    result = await db.execute(
        select(PersonaInquiry)
        .where(PersonaInquiry.driver_id == driver_id)
        .order_by(PersonaInquiry.created_at.desc())
    )
    inquiries = list(result.scalars().all())
    return [
        PersonaInquiryRead(
            id=inq.id,
            driver_id=inq.driver_id,
            persona_inquiry_id=inq.persona_inquiry_id,
            status=inq.status,
            template_id=inq.template_id,
            hosted_flow_url=_hosted_flow_url(inq),
        )
        for inq in inquiries
    ]

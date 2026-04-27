"""
Persona KYC service.

Responsibilities:
  - Create a Persona identity-verification inquiry via the REST API
  - Retrieve the latest inquiry for a driver
  - Verify incoming webhook signatures (HMAC-SHA256)
  - Handle webhook events → update inquiry status + driver compliance profile
"""

import hashlib
import hmac
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.compliance import ComplianceStatus, DriverComplianceProfile
from models.persona import PersonaInquiry, PersonaInquiryStatus

PERSONA_BASE_URL = "https://withpersona.com/api/v1"

# Map Persona event names → our status enum
_EVENT_TO_STATUS: dict[str, PersonaInquiryStatus] = {
    "inquiry.created":   PersonaInquiryStatus.created,
    "inquiry.started":   PersonaInquiryStatus.started,
    "inquiry.completed": PersonaInquiryStatus.completed,
    "inquiry.approved":  PersonaInquiryStatus.approved,
    "inquiry.declined":  PersonaInquiryStatus.declined,
    "inquiry.expired":   PersonaInquiryStatus.expired,
}


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.PERSONA_API_KEY}",
        "Persona-Version": settings.PERSONA_API_VERSION,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# ---------------------------------------------------------------------------
# Inquiry creation
# ---------------------------------------------------------------------------

async def create_inquiry(db: AsyncSession, driver_id: uuid.UUID) -> PersonaInquiry:
    """
    Call the Persona API to create a new inquiry for the given driver,
    persist a local record, and return it.

    If there is already a pending/active inquiry (created/started/completed)
    for this driver, return it instead of creating a duplicate.

    The caller receives the Persona-hosted-flow URL by combining
    the inquiry ID and session token:
        https://withpersona.com/verify?inquiry-id=<id>&session-token=<token>
    """
    if not settings.PERSONA_API_KEY or not settings.PERSONA_TEMPLATE_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Persona KYC is not configured on this server",
        )

    # Return existing active inquiry instead of creating a duplicate
    existing = await db.execute(
        select(PersonaInquiry)
        .where(
            PersonaInquiry.driver_id == driver_id,
            PersonaInquiry.status.in_([
                PersonaInquiryStatus.created,
                PersonaInquiryStatus.started,
                PersonaInquiryStatus.completed,
            ]),
        )
        .order_by(PersonaInquiry.created_at.desc())
        .limit(1)
    )
    active = existing.scalar_one_or_none()
    if active is not None:
        return active

    payload = {
        "data": {
            "attributes": {
                "inquiry-template-id": settings.PERSONA_TEMPLATE_ID,
                "reference-id": str(driver_id),
            }
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{PERSONA_BASE_URL}/inquiries",
                json=payload,
                headers=_headers(),
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach Persona API: {exc}",
        ) from exc

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Persona API returned {resp.status_code}",
        )

    data = resp.json()["data"]
    attrs = data["attributes"]

    inquiry = PersonaInquiry(
        driver_id=driver_id,
        persona_inquiry_id=data["id"],
        status=PersonaInquiryStatus.created,
        session_token=attrs.get("session-token"),
        template_id=settings.PERSONA_TEMPLATE_ID,
    )
    db.add(inquiry)
    await db.commit()
    await db.refresh(inquiry)
    return inquiry


async def get_latest_inquiry(
    db: AsyncSession, driver_id: uuid.UUID
) -> PersonaInquiry | None:
    """Return the most recent PersonaInquiry for a driver, or None."""
    result = await db.execute(
        select(PersonaInquiry)
        .where(PersonaInquiry.driver_id == driver_id)
        .order_by(PersonaInquiry.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Webhook signature verification
# ---------------------------------------------------------------------------

def verify_webhook_signature(
    raw_body: bytes, signature_header: str, secret: str
) -> bool:
    """
    Verify a Persona webhook request using its HMAC-SHA256 signature.

    Header format (supports key rotation — space-separated pairs):
        t=<unix_ts>,v1=<hex_sig>  [t=<unix_ts>,v1=<hex_sig> ...]

    The signed payload is: "<timestamp>.<raw_body_string>"
    """
    if not signature_header:
        return False

    try:
        for pair in signature_header.strip().split(" "):
            parts = {k: v for k, v in (p.split("=", 1) for p in pair.split(",") if "=" in p)}
            timestamp = parts.get("t")
            v1_sig = parts.get("v1")
            if not timestamp or not v1_sig:
                continue

            signed_payload = f"{timestamp}.{raw_body.decode('utf-8')}"
            expected = hmac.new(
                secret.encode("utf-8"),
                signed_payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            if hmac.compare_digest(expected, v1_sig):
                return True

        return False
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Webhook event handling
# ---------------------------------------------------------------------------

async def handle_webhook_event(
    db: AsyncSession,
    event_name: str,
    persona_inquiry_id: str,
) -> None:
    """
    Process a single Persona webhook event:
    1. Update the local PersonaInquiry status.
    2. Route to identity or vehicle handler based on template_id.
       - Identity template  → unlock / block DriverComplianceProfile.
       - Vehicle template   → update VehicleCompliance document flags.
    """
    result = await db.execute(
        select(PersonaInquiry).where(
            PersonaInquiry.persona_inquiry_id == persona_inquiry_id
        )
    )
    inquiry = result.scalar_one_or_none()
    if inquiry is None:
        return  # unknown inquiry — silently ignore

    new_status = _EVENT_TO_STATUS.get(event_name)
    if new_status:
        inquiry.status = new_status
        inquiry.updated_at = datetime.now(timezone.utc)

    is_vehicle_template = (
        inquiry.template_id == settings.PERSONA_VEHICLE_TEMPLATE_ID
        and settings.PERSONA_VEHICLE_TEMPLATE_ID
    )

    if is_vehicle_template:
        # Route to vehicle compliance handler
        from services.vehicle import (
            handle_vehicle_inquiry_approved,
            handle_vehicle_inquiry_declined,
        )
        if event_name == "inquiry.approved":
            await handle_vehicle_inquiry_approved(db, inquiry.driver_id, persona_inquiry_id)
        elif event_name == "inquiry.declined":
            await handle_vehicle_inquiry_declined(db, inquiry.driver_id, persona_inquiry_id)
    else:
        # Identity template — update DriverComplianceProfile
        if event_name == "inquiry.approved":
            await _handle_approval(db, inquiry.driver_id)
        elif event_name == "inquiry.declined":
            await _handle_decline(db, inquiry.driver_id)

    await db.commit()


async def _handle_approval(db: AsyncSession, driver_id: uuid.UUID) -> None:
    profile = await _get_or_create_profile(db, driver_id)
    profile.compliance_status = ComplianceStatus.approved
    profile.compliance_score = max(profile.compliance_score, 80)
    profile.auto_blocked = False
    profile.block_reason = None


async def _handle_decline(db: AsyncSession, driver_id: uuid.UUID) -> None:
    profile = await _get_or_create_profile(db, driver_id)
    profile.compliance_status = ComplianceStatus.blocked
    profile.auto_blocked = True
    profile.block_reason = "Persona KYC verification declined"


async def _get_or_create_profile(
    db: AsyncSession, driver_id: uuid.UUID
) -> DriverComplianceProfile:
    result = await db.execute(
        select(DriverComplianceProfile).where(
            DriverComplianceProfile.driver_id == driver_id
        )
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = DriverComplianceProfile(driver_id=driver_id)
        db.add(profile)
        await db.flush()
    return profile

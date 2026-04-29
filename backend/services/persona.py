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
import json
import logging
import uuid
from datetime import date, datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.compliance import ComplianceStatus, DriverComplianceProfile
from models.driver_verified_data import DriverVerifiedData
from models.persona import PersonaInquiry, PersonaInquiryStatus

logger = logging.getLogger(__name__)

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
                "redirect-uri": f"{settings.DRIVER_APP_URL}/kyc/done",
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


async def create_taxi_license_inquiry(
    db: AsyncSession, driver_id: uuid.UUID
) -> PersonaInquiry:
    """
    Create a Persona inquiry using the professional-taxi-license template.
    Idempotent — returns existing active inquiry if one exists.
    """
    if not settings.PERSONA_API_KEY or not settings.PERSONA_TAXI_LICENSE_TEMPLATE_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Taxi license verification is not configured",
        )

    # Return existing active inquiry (idempotent)
    existing = await db.execute(
        select(PersonaInquiry)
        .where(
            PersonaInquiry.driver_id == driver_id,
            PersonaInquiry.template_id == settings.PERSONA_TAXI_LICENSE_TEMPLATE_ID,
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
                "inquiry-template-id": settings.PERSONA_TAXI_LICENSE_TEMPLATE_ID,
                "reference-id": f"{driver_id}:taxi-license",
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
        template_id=settings.PERSONA_TAXI_LICENSE_TEMPLATE_ID,
    )
    db.add(inquiry)
    await db.commit()
    await db.refresh(inquiry)
    return inquiry


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

    # Mirror status changes to user.auth_status for completed events
    if event_name == "inquiry.completed":
        from models.user import User, AuthStatus
        from sqlalchemy import select as _select
        _res = await db.execute(_select(User).where(User.id == inquiry.driver_id))
        _user = _res.scalar_one_or_none()
        if _user:
            _user.auth_status = AuthStatus.persona_completed

    is_vehicle_template = (
        inquiry.template_id == settings.PERSONA_VEHICLE_TEMPLATE_ID
        and settings.PERSONA_VEHICLE_TEMPLATE_ID
    )
    is_taxi_license_template = bool(
        settings.PERSONA_TAXI_LICENSE_TEMPLATE_ID
        and inquiry.template_id == settings.PERSONA_TAXI_LICENSE_TEMPLATE_ID
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
    elif is_taxi_license_template:
        # Route to taxi-license compliance handler
        if event_name == "inquiry.approved":
            await _handle_taxi_license_approval(db, inquiry.driver_id)
        elif event_name == "inquiry.declined":
            await _handle_taxi_license_decline(db, inquiry.driver_id)
    else:
        # Identity template — update DriverComplianceProfile
        if event_name == "inquiry.approved":
            await _handle_approval(db, inquiry.driver_id, persona_inquiry_id)
        elif event_name == "inquiry.declined":
            await _handle_decline(db, inquiry.driver_id)

    await db.commit()


async def _handle_approval(db: AsyncSession, driver_id: uuid.UUID, persona_inquiry_id: str) -> None:
    # 1. Extract verified data from Persona
    await _extract_and_save_verified_data(db, driver_id, persona_inquiry_id)

    profile = await _get_or_create_profile(db, driver_id)
    profile.compliance_status = ComplianceStatus.approved
    profile.compliance_score = max(profile.compliance_score, 80)
    profile.auto_blocked = False
    profile.block_reason = None
    # Update user auth_status → approved + send congratulations WA message
    from models.user import User, AuthStatus
    from sqlalchemy import select as _select
    res = await db.execute(_select(User).where(User.id == driver_id))
    user = res.scalar_one_or_none()
    if user:
        user.auth_status = AuthStatus.approved
        # Send congratulations WhatsApp message (spec requirement)
        try:
            from services.whatsapp import send_text
            await send_text(
                user.phone,
                "🎉 *EasyTaxi* — המסמכים שלך אושרו!\n\n"
                "אתה מאושר כעת כנהג פעיל במערכת.\n"
                "✅ תוכל להתחיל לקבל נסיעות מיד.\n\n"
                "ברוך הבא לצוות EasyTaxi Israel! 🚕",
            )
        except Exception as exc:
            logger.warning("Failed to send approval WA message to driver %s: %s", driver_id, exc)


# ---------------------------------------------------------------------------
# Extract verified identity data from Persona inquiry
# ---------------------------------------------------------------------------

def _parse_date(s: str | None) -> date | None:
    """Parse ISO date string 'YYYY-MM-DD' → date, None if missing/invalid."""
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


async def _extract_and_save_verified_data(
    db: AsyncSession,
    driver_id: uuid.UUID,
    persona_inquiry_id: str,
) -> None:
    """
    Fetch the full Persona inquiry (with verifications included) and save
    the extracted identity/license/selfie data to DriverVerifiedData.

    Fails silently — any extraction error is logged but does NOT block approval.
    """
    if not settings.PERSONA_API_KEY:
        return

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{PERSONA_BASE_URL}/inquiries/{persona_inquiry_id}",
                params={"include": "verifications"},
                headers=_headers(),
            )
        if resp.status_code != 200:
            logger.warning(
                "Persona inquiry fetch returned %s for %s", resp.status_code, persona_inquiry_id
            )
            return

        body = resp.json()
        raw_json = json.dumps(body)

        included: list[dict] = body.get("included", [])

        gov_id_attrs: dict = {}
        driver_lic_attrs: dict = {}
        selfie_passed = False

        for item in included:
            vtype = item.get("type", "")
            attrs = item.get("attributes", {})

            if vtype == "verification/selfie":
                selfie_passed = attrs.get("status") == "passed"

            elif vtype in ("verification/government-id", "verification/driver-license"):
                id_class = attrs.get("id-class", "")
                # "dl" = driver license, "id_card"/"passport" = gov ID
                if id_class == "dl" or vtype == "verification/driver-license":
                    if not driver_lic_attrs:
                        driver_lic_attrs = attrs
                else:
                    if not gov_id_attrs:
                        gov_id_attrs = attrs

        # Build record
        record = DriverVerifiedData(
            driver_id=driver_id,
            persona_inquiry_id=persona_inquiry_id,
            # Government ID
            verified_name_first=gov_id_attrs.get("name-first") or driver_lic_attrs.get("name-first"),
            verified_name_last=gov_id_attrs.get("name-last") or driver_lic_attrs.get("name-last"),
            id_number=gov_id_attrs.get("identification-number"),
            date_of_birth=_parse_date(gov_id_attrs.get("birthdate") or driver_lic_attrs.get("birthdate")),
            issuing_country=gov_id_attrs.get("issuing-country") or driver_lic_attrs.get("issuing-country"),
            gov_id_expiry=_parse_date(gov_id_attrs.get("expiration-date")),
            gov_id_passed=gov_id_attrs.get("status") == "passed",
            # Driver's license
            license_number=driver_lic_attrs.get("identification-number"),
            license_class=driver_lic_attrs.get("vehicle-class") or driver_lic_attrs.get("restrictions"),
            license_expiry_date=_parse_date(driver_lic_attrs.get("expiration-date")),
            license_passed=driver_lic_attrs.get("status") == "passed",
            # Selfie
            selfie_passed=selfie_passed,
            # Raw audit
            raw_persona_data=raw_json,
        )
        db.add(record)
        logger.info("Saved DriverVerifiedData for driver %s inquiry %s", driver_id, persona_inquiry_id)

    except Exception as exc:
        logger.error(
            "Failed to extract Persona verified data for driver %s: %s", driver_id, exc
        )


async def _handle_decline(db: AsyncSession, driver_id: uuid.UUID) -> None:
    profile = await _get_or_create_profile(db, driver_id)
    profile.compliance_status = ComplianceStatus.blocked
    profile.auto_blocked = True
    profile.block_reason = "Persona KYC verification declined"


async def _handle_taxi_license_approval(db: AsyncSession, driver_id: uuid.UUID) -> None:
    """Persona approved the professional taxi license — mark taxi_license_approved=True."""
    from datetime import date as _date
    profile = await _get_or_create_profile(db, driver_id)
    profile.taxi_license_approved = True
    # Try to read expiry from latest DriverVerifiedData for this driver
    result = await db.execute(
        select(DriverVerifiedData)
        .where(DriverVerifiedData.driver_id == driver_id)
        .order_by(DriverVerifiedData.verified_at.desc())
        .limit(1)
    )
    dvd = result.scalar_one_or_none()
    if dvd and dvd.license_expiry_date:
        profile.taxi_license_expiry = dvd.license_expiry_date
    logger.info("Taxi license approved for driver %s", driver_id)


async def _handle_taxi_license_decline(db: AsyncSession, driver_id: uuid.UUID) -> None:
    """Persona declined the professional taxi license."""
    profile = await _get_or_create_profile(db, driver_id)
    profile.taxi_license_approved = False
    logger.info("Taxi license declined for driver %s", driver_id)


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

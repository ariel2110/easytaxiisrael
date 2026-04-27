"""
Vehicle compliance service.

Responsibilities:
  - Israeli law checklist for rideshare drivers
  - Vehicle photo management (upload, list, admin review)
  - Compliance evaluation (all checks pass → approved)
  - Persona vehicle-document inquiry creation
"""

import uuid
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.vehicle import (
    VehicleCompliance,
    VehicleComplianceStatus,
    VehiclePhoto,
    VehiclePhotoStatus,
    VehiclePhotoType,
)
from models.persona import PersonaInquiry, PersonaInquiryStatus

# ---------------------------------------------------------------------------
# Israeli law checklist — required for rideshare drivers
# ---------------------------------------------------------------------------

VEHICLE_CHECKLIST = [
    {
        "id": "insurance_mandatory",
        "name_he": "ביטוח חובה תקף",
        "name_en": "Mandatory Insurance (valid)",
        "legal_basis": "חוק פיצויים לנפגעי תאונות דרכים, תשל\"ה-1975",
        "required": True,
        "accepted_formats": ["PDF", "תמונה ברורה"],
        "notes": "חייב להיות בתוקף — לא פג תוקף",
    },
    {
        "id": "insurance_commercial",
        "name_he": "ביטוח מסחרי / צד ג' מורחב לשימוש מסחרי",
        "name_en": "Commercial / Extended Third-Party Insurance",
        "legal_basis": "תקנות ביטוח רכב מנועי (ביטוח צד שלישי), תשכ\"ז-1967",
        "required": True,
        "accepted_formats": ["PDF", "תמונה ברורה"],
        "notes": "ביטוח רגיל אינו מספיק לנהיגה מסחרית — חייב לכלול כיסוי מסחרי",
    },
    {
        "id": "vehicle_test",
        "name_he": "תעודת טסט תקפה (רישיון רכב תקין)",
        "name_en": "Vehicle Roadworthiness Certificate (valid)",
        "legal_basis": "תקנות התעבורה, תשכ\"א-1961, תקנה 312",
        "required": True,
        "accepted_formats": ["PDF", "תמונה ברורה של מדבקת הטסט / אישור המכון"],
        "notes": "הטסט חייב להיות בתוקף. רכב שנכשל בטסט — פסול לנהיגה",
    },
    {
        "id": "registration",
        "name_he": "רישיון רכב (רישוי רכב תקף)",
        "name_en": "Vehicle Registration License",
        "legal_basis": "פקודת התעבורה [נוסח חדש], תשכ\"א-1961, סעיף 2",
        "required": True,
        "accepted_formats": ["PDF", "תמונה ברורה"],
        "notes": "חייב להתאים לרכב הרשום",
    },
    {
        "id": "vehicle_age",
        "name_he": "גיל רכב — עד 7 שנים",
        "name_en": "Vehicle Age ≤ 7 Years",
        "legal_basis": "תקנות שירות מונית / הסעה שיתופית — תקנה 4(א)",
        "required": True,
        "accepted_formats": ["נגזר מרישיון הרכב אוטומטית"],
        "notes": "רכב ישן מ-7 שנים אינו כשיר לנהיגה כנהג EasyTaxi",
    },
    {
        "id": "photo_front",
        "name_he": "תמונת חזית הרכב",
        "name_en": "Vehicle Front Photo",
        "legal_basis": "דרישה פנימית EasyTaxi",
        "required": True,
        "accepted_formats": ["JPEG", "PNG — רזולוציה מינימלית 1024×768"],
        "notes": "כל לוחית הרישוי חייבת להיות גלויה וברורה",
    },
    {
        "id": "photo_rear",
        "name_he": "תמונת אחורי הרכב",
        "name_en": "Vehicle Rear Photo",
        "legal_basis": "דרישה פנימית EasyTaxi",
        "required": True,
        "accepted_formats": ["JPEG", "PNG — רזולוציה מינימלית 1024×768"],
        "notes": "לוחית רישוי אחורית חייבת להיות גלויה",
    },
    {
        "id": "photo_driver_side",
        "name_he": "תמונת צד נהג",
        "name_en": "Driver Side Photo",
        "legal_basis": "דרישה פנימית EasyTaxi",
        "required": True,
        "accepted_formats": ["JPEG", "PNG — רזולוציה מינימלית 1024×768"],
        "notes": "כל הרכב מהצד — חייב להיות ברור וללא הצללות",
    },
    {
        "id": "photo_passenger_side",
        "name_he": "תמונת צד נוסע",
        "name_en": "Passenger Side Photo",
        "legal_basis": "דרישה פנימית EasyTaxi",
        "required": True,
        "accepted_formats": ["JPEG", "PNG — רזולוציה מינימלית 1024×768"],
        "notes": "כל הרכב מהצד",
    },
    {
        "id": "photo_interior_front",
        "name_he": "תמונת פנים קדמי (לוח מחוונים + מושב נהג)",
        "name_en": "Interior Front Photo",
        "legal_basis": "דרישה פנימית EasyTaxi",
        "required": True,
        "accepted_formats": ["JPEG", "PNG — רזולוציה מינימלית 1024×768"],
        "notes": "הרכב חייב להיות נקי — ניתן לסרב אם לא נקי",
    },
    {
        "id": "photo_interior_rear",
        "name_he": "תמונת פנים אחורי (מושב אחורי לנוסעים)",
        "name_en": "Interior Rear Photo",
        "legal_basis": "דרישה פנימית EasyTaxi",
        "required": True,
        "accepted_formats": ["JPEG", "PNG — רזולוציה מינימלית 1024×768"],
        "notes": "חגורות בטיחות חייבות להיות גלויות ותקינות",
    },
]

REQUIRED_PHOTO_TYPES = [
    VehiclePhotoType.front,
    VehiclePhotoType.rear,
    VehiclePhotoType.driver_side,
    VehiclePhotoType.passenger_side,
    VehiclePhotoType.interior_front,
    VehiclePhotoType.interior_rear,
]

PERSONA_BASE_URL = "https://withpersona.com/api/v1"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.PERSONA_API_KEY}",
        "Persona-Version": settings.PERSONA_API_VERSION,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# ---------------------------------------------------------------------------
# Photo management
# ---------------------------------------------------------------------------

async def upload_photo(
    db: AsyncSession,
    driver_id: uuid.UUID,
    photo_type: VehiclePhotoType,
    file_key: str,
) -> VehiclePhoto:
    """Create or replace the photo of a given type for a driver."""
    # If one already exists for this type, replace it
    existing = await db.execute(
        select(VehiclePhoto).where(
            VehiclePhoto.driver_id == driver_id,
            VehiclePhoto.photo_type == photo_type,
        )
    )
    photo = existing.scalar_one_or_none()
    if photo:
        photo.file_key = file_key
        photo.status = VehiclePhotoStatus.pending
        photo.rejection_reason = None
        photo.reviewed_at = None
        photo.reviewed_by = None
        photo.uploaded_at = datetime.now(timezone.utc)
    else:
        photo = VehiclePhoto(
            driver_id=driver_id,
            photo_type=photo_type,
            file_key=file_key,
        )
        db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return photo


async def list_photos(db: AsyncSession, driver_id: uuid.UUID) -> list[VehiclePhoto]:
    result = await db.execute(
        select(VehiclePhoto)
        .where(VehiclePhoto.driver_id == driver_id)
        .order_by(VehiclePhoto.photo_type)
    )
    return list(result.scalars().all())


async def review_photo(
    db: AsyncSession,
    photo_id: uuid.UUID,
    approved: bool,
    reviewer_id: uuid.UUID,
    rejection_reason: str | None = None,
) -> VehiclePhoto:
    photo = await db.get(VehiclePhoto, photo_id)
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    photo.status = VehiclePhotoStatus.approved if approved else VehiclePhotoStatus.rejected
    photo.rejection_reason = rejection_reason if not approved else None
    photo.reviewed_at = datetime.now(timezone.utc)
    photo.reviewed_by = reviewer_id
    await db.commit()
    await db.refresh(photo)
    # Re-evaluate overall compliance
    await _evaluate_photos_complete(db, photo.driver_id)
    return photo


# ---------------------------------------------------------------------------
# Compliance evaluation
# ---------------------------------------------------------------------------

async def get_or_create_compliance(
    db: AsyncSession, driver_id: uuid.UUID
) -> VehicleCompliance:
    result = await db.execute(
        select(VehicleCompliance).where(VehicleCompliance.driver_id == driver_id)
    )
    compliance = result.scalar_one_or_none()
    if compliance is None:
        compliance = VehicleCompliance(driver_id=driver_id)
        db.add(compliance)
        await db.flush()
    return compliance


async def _evaluate_photos_complete(
    db: AsyncSession, driver_id: uuid.UUID
) -> bool:
    """Check if all 6 required photos are approved."""
    result = await db.execute(
        select(VehiclePhoto).where(
            VehiclePhoto.driver_id == driver_id,
            VehiclePhoto.status == VehiclePhotoStatus.approved,
        )
    )
    approved_types = {p.photo_type for p in result.scalars().all()}
    complete = all(t in approved_types for t in REQUIRED_PHOTO_TYPES)

    compliance = await get_or_create_compliance(db, driver_id)
    compliance.photos_complete = complete
    _recalculate_status(compliance)
    await db.commit()
    return complete


def _recalculate_status(compliance: VehicleCompliance) -> None:
    """Set overall status based on all flags."""
    all_ok = (
        compliance.insurance_mandatory_valid
        and compliance.insurance_commercial_valid
        and compliance.vehicle_test_valid
        and compliance.registration_valid
        and compliance.vehicle_age_ok
        and compliance.photos_complete
    )
    if all_ok:
        compliance.status = VehicleComplianceStatus.approved
    elif compliance.status == VehicleComplianceStatus.approved:
        # Downgrade if something was revoked
        compliance.status = VehicleComplianceStatus.pending


async def update_document_flags(
    db: AsyncSession,
    driver_id: uuid.UUID,
    *,
    insurance_mandatory: bool | None = None,
    insurance_commercial: bool | None = None,
    vehicle_test: bool | None = None,
    registration: bool | None = None,
    vehicle_age_ok: bool | None = None,
    persona_inquiry_id: str | None = None,
    rejection_notes: str | None = None,
    force_status: VehicleComplianceStatus | None = None,
) -> VehicleCompliance:
    """Update one or more compliance flags and recalculate overall status."""
    compliance = await get_or_create_compliance(db, driver_id)
    if insurance_mandatory is not None:
        compliance.insurance_mandatory_valid = insurance_mandatory
    if insurance_commercial is not None:
        compliance.insurance_commercial_valid = insurance_commercial
    if vehicle_test is not None:
        compliance.vehicle_test_valid = vehicle_test
    if registration is not None:
        compliance.registration_valid = registration
    if vehicle_age_ok is not None:
        compliance.vehicle_age_ok = vehicle_age_ok
    if persona_inquiry_id is not None:
        compliance.persona_inquiry_id = persona_inquiry_id
    if rejection_notes is not None:
        compliance.rejection_notes = rejection_notes
    if force_status is not None:
        compliance.status = force_status
    else:
        _recalculate_status(compliance)
    await db.commit()
    await db.refresh(compliance)
    return compliance


# ---------------------------------------------------------------------------
# Persona vehicle inquiry
# ---------------------------------------------------------------------------

async def create_vehicle_inquiry(
    db: AsyncSession, driver_id: uuid.UUID
) -> PersonaInquiry:
    """Create a Persona inquiry using the vehicle-document template."""
    if not settings.PERSONA_API_KEY or not settings.PERSONA_VEHICLE_TEMPLATE_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vehicle document verification is not configured",
        )

    # Return existing active vehicle inquiry (idempotent)
    result = await db.execute(
        select(PersonaInquiry).where(
            PersonaInquiry.driver_id == driver_id,
            PersonaInquiry.template_id == settings.PERSONA_VEHICLE_TEMPLATE_ID,
            PersonaInquiry.status.in_([
                PersonaInquiryStatus.created,
                PersonaInquiryStatus.started,
                PersonaInquiryStatus.completed,
            ]),
        )
        .order_by(PersonaInquiry.created_at.desc())
        .limit(1)
    )
    active = result.scalar_one_or_none()
    if active is not None:
        return active

    payload = {
        "data": {
            "attributes": {
                "inquiry-template-id": settings.PERSONA_VEHICLE_TEMPLATE_ID,
                "reference-id": f"{driver_id}:vehicle",
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
        template_id=settings.PERSONA_VEHICLE_TEMPLATE_ID,
    )
    db.add(inquiry)
    await db.commit()
    await db.refresh(inquiry)
    return inquiry


async def handle_vehicle_inquiry_approved(
    db: AsyncSession, driver_id: uuid.UUID, persona_inquiry_id: str
) -> None:
    """Persona approved the vehicle document inquiry — mark all doc flags as valid."""
    await update_document_flags(
        db,
        driver_id,
        insurance_mandatory=True,
        insurance_commercial=True,
        vehicle_test=True,
        registration=True,
        vehicle_age_ok=True,
        persona_inquiry_id=persona_inquiry_id,
    )


async def handle_vehicle_inquiry_declined(
    db: AsyncSession, driver_id: uuid.UUID, persona_inquiry_id: str
) -> None:
    """Persona declined the vehicle document inquiry — block vehicle compliance."""
    await update_document_flags(
        db,
        driver_id,
        persona_inquiry_id=persona_inquiry_id,
        rejection_notes="Vehicle document verification declined by Persona",
        force_status=VehicleComplianceStatus.rejected,
    )

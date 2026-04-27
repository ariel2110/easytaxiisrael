"""
Vehicle compliance API routes.

Endpoints:
  GET  /vehicle/checklist              — רשימת כל הדרישות (ציבורי לנהגים)
  POST /vehicle/inquiry                — נהג מתחיל אימות מסמכי רכב ב-Persona
  GET  /vehicle/inquiry/status         — סטטוס אימות מסמכי הרכב
  POST /vehicle/photos                 — העלאת תמונת רכב
  GET  /vehicle/photos                 — רשימת תמונות הנהג
  GET  /vehicle/compliance             — סטטוס הציות המלא של הנהג
  PATCH /admin/vehicle/{driver_id}/documents   — [Admin] עדכון דגלי מסמכים ידני
  POST  /admin/vehicle/photos/{photo_id}/review — [Admin] אישור/דחיית תמונה
  GET   /admin/vehicle/{driver_id}/compliance  — [Admin] צפייה בציות של נהג
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import httpx
import respx

from core.config import settings
from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.persona import PersonaInquiry
from models.user import User, UserRole
from models.vehicle import VehicleComplianceStatus, VehiclePhoto, VehiclePhotoType
from services import vehicle as vehicle_svc

router = APIRouter(prefix="/vehicle", tags=["vehicle"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PhotoUpload(BaseModel):
    photo_type: VehiclePhotoType
    file_key: str  # S3 key / storage path returned by file upload endpoint


class PhotoRead(BaseModel):
    id: uuid.UUID
    driver_id: uuid.UUID
    photo_type: VehiclePhotoType
    status: str
    file_key: str
    rejection_reason: str | None

    model_config = {"from_attributes": True}


class VehicleComplianceRead(BaseModel):
    driver_id: uuid.UUID
    status: VehicleComplianceStatus
    insurance_mandatory_valid: bool
    insurance_commercial_valid: bool
    vehicle_test_valid: bool
    registration_valid: bool
    vehicle_age_ok: bool
    photos_complete: bool
    persona_inquiry_id: str | None
    rejection_notes: str | None

    model_config = {"from_attributes": True}


class DocumentFlagsUpdate(BaseModel):
    insurance_mandatory: bool | None = None
    insurance_commercial: bool | None = None
    vehicle_test: bool | None = None
    registration: bool | None = None
    vehicle_age_ok: bool | None = None
    rejection_notes: str | None = None


class PhotoReview(BaseModel):
    approved: bool
    rejection_reason: str | None = None


class VehicleInquiryResponse(BaseModel):
    persona_inquiry_id: str
    status: str
    hosted_flow_url: str | None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _flow_url(inquiry: PersonaInquiry) -> str | None:
    if not inquiry.session_token:
        return None
    return (
        f"https://withpersona.com/verify"
        f"?inquiry-id={inquiry.persona_inquiry_id}"
        f"&session-token={inquiry.session_token}"
    )


# ---------------------------------------------------------------------------
# Public checklist (no auth required — drivers see requirements before signing up)
# ---------------------------------------------------------------------------

@router.get(
    "/checklist",
    summary="Vehicle compliance checklist (Israeli law requirements)",
)
async def get_checklist() -> list[dict]:
    """
    Return the full list of documents and photos required by Israeli law
    for rideshare drivers. No authentication required.
    """
    return vehicle_svc.VEHICLE_CHECKLIST


# ---------------------------------------------------------------------------
# Driver routes
# ---------------------------------------------------------------------------

@router.post(
    "/inquiry",
    response_model=VehicleInquiryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start Persona vehicle document verification (driver)",
)
async def start_vehicle_inquiry(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> VehicleInquiryResponse:
    """
    Create a Persona inquiry for vehicle document verification.
    Returns a hosted_flow_url for the driver to upload insurance + test + registration.
    """
    inquiry = await vehicle_svc.create_vehicle_inquiry(db, current_user.id)
    return VehicleInquiryResponse(
        persona_inquiry_id=inquiry.persona_inquiry_id,
        status=inquiry.status.value,
        hosted_flow_url=_flow_url(inquiry),
    )


@router.get(
    "/inquiry/status",
    response_model=VehicleInquiryResponse | None,
    summary="Get vehicle document inquiry status (driver)",
)
async def get_vehicle_inquiry_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> VehicleInquiryResponse | None:
    result = await db.execute(
        select(PersonaInquiry)
        .where(
            PersonaInquiry.driver_id == current_user.id,
            PersonaInquiry.template_id == settings.PERSONA_VEHICLE_TEMPLATE_ID,
        )
        .order_by(PersonaInquiry.created_at.desc())
        .limit(1)
    )
    inquiry = result.scalar_one_or_none()
    if inquiry is None:
        return None
    return VehicleInquiryResponse(
        persona_inquiry_id=inquiry.persona_inquiry_id,
        status=inquiry.status.value,
        hosted_flow_url=_flow_url(inquiry),
    )


@router.post(
    "/photos",
    response_model=PhotoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a vehicle photo (driver)",
)
async def upload_photo(
    payload: PhotoUpload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> PhotoRead:
    photo = await vehicle_svc.upload_photo(
        db, current_user.id, payload.photo_type, payload.file_key
    )
    return PhotoRead.model_validate(photo)


@router.get(
    "/photos",
    response_model=list[PhotoRead],
    summary="List own vehicle photos (driver)",
)
async def list_photos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> list[PhotoRead]:
    photos = await vehicle_svc.list_photos(db, current_user.id)
    return [PhotoRead.model_validate(p) for p in photos]


@router.get(
    "/compliance",
    response_model=VehicleComplianceRead,
    summary="Get own vehicle compliance status (driver)",
)
async def get_compliance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> VehicleComplianceRead:
    compliance = await vehicle_svc.get_or_create_compliance(db, current_user.id)
    return VehicleComplianceRead.model_validate(compliance)


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------

@router.post(
    "/admin/photos/{photo_id}/review",
    response_model=PhotoRead,
    summary="[Admin] Approve or reject a vehicle photo",
)
async def admin_review_photo(
    photo_id: uuid.UUID,
    payload: PhotoReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
) -> PhotoRead:
    if not payload.approved and not payload.rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rejection_reason required when rejecting a photo",
        )
    photo = await vehicle_svc.review_photo(
        db, photo_id, payload.approved, current_user.id, payload.rejection_reason
    )
    return PhotoRead.model_validate(photo)


@router.patch(
    "/admin/{driver_id}/documents",
    response_model=VehicleComplianceRead,
    summary="[Admin] Manually update vehicle document compliance flags",
)
async def admin_update_documents(
    driver_id: uuid.UUID,
    payload: DocumentFlagsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> VehicleComplianceRead:
    compliance = await vehicle_svc.update_document_flags(
        db,
        driver_id,
        insurance_mandatory=payload.insurance_mandatory,
        insurance_commercial=payload.insurance_commercial,
        vehicle_test=payload.vehicle_test,
        registration=payload.registration,
        vehicle_age_ok=payload.vehicle_age_ok,
        rejection_notes=payload.rejection_notes,
    )
    return VehicleComplianceRead.model_validate(compliance)


@router.get(
    "/admin/{driver_id}/compliance",
    response_model=VehicleComplianceRead,
    summary="[Admin] View any driver's vehicle compliance",
)
async def admin_get_compliance(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> VehicleComplianceRead:
    compliance = await vehicle_svc.get_or_create_compliance(db, driver_id)
    return VehicleComplianceRead.model_validate(compliance)

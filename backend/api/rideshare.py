"""
Rideshare driver API routes.

Endpoints (public/driver):
  GET  /rideshare/info                  — חוק אובר: סטטוס, FAQ, קישורים (ציבורי)
  GET  /rideshare/checklist             — רשימת מסמכים נדרשים (ציבורי)
  POST /rideshare/register              — נהג מצהיר שהוא שיתופי (לא מורשה)
  POST /rideshare/acknowledge           — נהג מאשר שלא יקח כסף עד אישור חוק
  GET  /rideshare/profile               — סטטוס הפרופיל של הנהג
  POST /rideshare/documents             — העלאת מסמך
  GET  /rideshare/documents             — רשימת מסמכים שהועלו

Endpoints (admin):
  POST /rideshare/admin/documents/{id}/review  — אישור/דחיית מסמך
  GET  /rideshare/admin/{driver_id}/profile    — צפייה בפרופיל נהג
  GET  /rideshare/admin/drivers                — רשימת כל נהגי ה"הובר"
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.rideshare import RideshareDocStatus, RideshareDocType, RideshareStatus
from models.user import DriverType, User, UserRole
from services import rideshare as svc

router = APIRouter(prefix="/rideshare", tags=["rideshare"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RideshareProfileRead(BaseModel):
    driver_id: uuid.UUID
    status: RideshareStatus
    acknowledged_no_payment: bool
    acknowledged_at: str | None = None
    admin_notes: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_dt(cls, profile) -> "RideshareProfileRead":
        return cls(
            driver_id=profile.driver_id,
            status=profile.status,
            acknowledged_no_payment=profile.acknowledged_no_payment,
            acknowledged_at=(
                profile.acknowledged_at.isoformat()
                if profile.acknowledged_at else None
            ),
            admin_notes=profile.admin_notes,
        )


class DocumentUpload(BaseModel):
    doc_type: RideshareDocType
    file_key: str


class DocumentRead(BaseModel):
    id: uuid.UUID
    driver_id: uuid.UUID
    doc_type: RideshareDocType
    status: RideshareDocStatus
    file_key: str
    rejection_reason: str | None

    model_config = {"from_attributes": True}


class DocumentReview(BaseModel):
    approved: bool
    rejection_reason: str | None = None


class RegisterResponse(BaseModel):
    message: str
    driver_type: str
    profile: RideshareProfileRead


# ---------------------------------------------------------------------------
# Public endpoints — no auth required
# ---------------------------------------------------------------------------

@router.get(
    "/info",
    summary="חוק אובר — סטטוס חקיקה, הסבר ושאלות נפוצות",
)
async def get_law_info() -> dict:
    """
    Return current legislation status, explanation of why payments are blocked,
    links to official sources, and FAQ in Hebrew.
    """
    return {
        "legislation": svc.LEGISLATION_STATUS,
        "faq": svc.RIDESHARE_FAQ,
    }


@router.get(
    "/checklist",
    summary="מסמכים נדרשים לנהגי שיתוף נסיעות (ציבורי)",
)
async def get_checklist() -> list[dict]:
    """Return the full list of documents required for rideshare drivers."""
    return [
        {**req, "id": req["id"].value}
        for req in svc.REQUIRED_DOCUMENTS
    ]


# ---------------------------------------------------------------------------
# Driver endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_200_OK,
    summary="הצהרה: אני לא נהג מונית מורשה (רישום שיתופי)",
)
async def register_as_rideshare(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> RegisterResponse:
    """
    Driver declares they are NOT a licensed taxi driver.
    They will be registered as a rideshare (Uber-style) driver.
    They can use all app features EXCEPT receiving payment until the law
    comes into full effect.
    """
    profile = await svc.register_as_rideshare(db, current_user)
    await db.refresh(current_user)
    return RegisterResponse(
        message=(
            "נרשמת בהצלחה כנהג שיתופי. "
            "שים לב: קבלת תשלום אסורה עד לאישור החקיקה הסופית. "
            "אנא קרא את ההסבר ב-GET /rideshare/info ואשר את התנאים."
        ),
        driver_type=DriverType.rideshare.value,
        profile=RideshareProfileRead.from_orm_with_dt(profile),
    )


@router.post(
    "/acknowledge",
    response_model=RideshareProfileRead,
    summary="אישור: לא אקח כסף עד לאישור החוק",
)
async def acknowledge_no_payment(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> RideshareProfileRead:
    """
    Driver explicitly acknowledges they will NOT accept any payment
    until the Israeli ride-sharing law comes into full effect.
    This acknowledgment is required before uploading documents.
    """
    if current_user.driver_type != DriverType.rideshare:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="יש להירשם תחילה כנהג שיתופי (POST /rideshare/register)",
        )
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
    profile = await svc.acknowledge_no_payment(db, current_user.id, client_ip)
    return RideshareProfileRead.from_orm_with_dt(profile)


@router.get(
    "/profile",
    response_model=RideshareProfileRead,
    summary="סטטוס הפרופיל שלי כנהג שיתופי",
)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> RideshareProfileRead:
    profile = await svc.get_or_create_profile(db, current_user.id)
    return RideshareProfileRead.from_orm_with_dt(profile)


@router.post(
    "/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
    summary="העלאת מסמך לתיק הנהג השיתופי",
)
async def upload_document(
    payload: DocumentUpload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> DocumentRead:
    if current_user.driver_type != DriverType.rideshare:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ניתן להעלות מסמכים רק לנהגים שיתופיים. "
                   "יש להירשם תחילה: POST /rideshare/register",
        )
    doc = await svc.upload_document(
        db, current_user.id, payload.doc_type, payload.file_key
    )
    return DocumentRead.model_validate(doc)


@router.get(
    "/documents",
    response_model=list[DocumentRead],
    summary="רשימת מסמכים שהועלו",
)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> list[DocumentRead]:
    docs = await svc.list_documents(db, current_user.id)
    return [DocumentRead.model_validate(d) for d in docs]


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/admin/documents/{doc_id}/review",
    response_model=DocumentRead,
    summary="[Admin] אישור / דחיית מסמך נהג שיתופי",
)
async def admin_review_document(
    doc_id: uuid.UUID,
    payload: DocumentReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
) -> DocumentRead:
    if not payload.approved and not payload.rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rejection_reason required when rejecting a document",
        )
    doc = await svc.review_document(
        db, doc_id, payload.approved, current_user.id, payload.rejection_reason
    )
    return DocumentRead.model_validate(doc)


@router.get(
    "/admin/{driver_id}/profile",
    response_model=RideshareProfileRead,
    summary="[Admin] צפייה בפרופיל נהג שיתופי",
)
async def admin_get_profile(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> RideshareProfileRead:
    profile = await svc.get_or_create_profile(db, driver_id)
    return RideshareProfileRead.from_orm_with_dt(profile)


@router.get(
    "/admin/drivers",
    summary="[Admin] רשימת כל נהגי ה'הובר' הרשומים",
)
async def admin_list_rideshare_drivers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[dict]:
    from models.rideshare import RideshareProfile as RSP
    result = await db.execute(
        select(RSP).order_by(RSP.created_at.desc())
    )
    profiles = result.scalars().all()
    return [
        {
            "driver_id": str(p.driver_id),
            "status": p.status.value,
            "acknowledged": p.acknowledged_no_payment,
            "acknowledged_at": p.acknowledged_at.isoformat() if p.acknowledged_at else None,
        }
        for p in profiles
    ]

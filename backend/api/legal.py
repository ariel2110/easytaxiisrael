import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.user import User, UserRole
from schemas.legal import (
    ComplianceProgressRead,
    DriverLegalStatusRead,
    LegalDocumentRead,
    LegalDocumentUpload,
)
from services import legal as legal_service

router = APIRouter(prefix="/driver", tags=["legal"])


@router.get(
    "/compliance",
    response_model=DriverLegalStatusRead,
    summary="Get driver's legal compliance status",
)
async def get_my_compliance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> DriverLegalStatusRead:
    return await legal_service.get_legal_status(db, current_user.id)


@router.post(
    "/document",
    response_model=LegalDocumentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a legal document",
)
async def upload_document(
    payload: LegalDocumentUpload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> LegalDocumentRead:
    return await legal_service.upload_document(db, current_user, payload)


@router.get(
    "/compliance/progress",
    response_model=ComplianceProgressRead,
    summary="Get step-by-step compliance progress",
)
async def get_compliance_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> ComplianceProgressRead:
    return await legal_service.get_compliance_progress(db, current_user.id)


# Admin endpoints
@router.get(
    "/admin/compliance/{driver_id}",
    response_model=ComplianceProgressRead,
    summary="[Admin] Get compliance progress for any driver",
    tags=["legal"],
)
async def admin_get_compliance(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> ComplianceProgressRead:
    return await legal_service.get_compliance_progress(db, driver_id)


# ---------------------------------------------------------------------------
# Terms of Service acceptance
# ---------------------------------------------------------------------------

tos_router = APIRouter(prefix="/tos", tags=["legal"])


@tos_router.post(
    "/accept",
    status_code=status.HTTP_200_OK,
    summary="Record that the current user has accepted the Terms of Service",
)
async def accept_tos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.tos_accepted_at is None:
        current_user.tos_accepted_at = datetime.now(timezone.utc)
        await db.commit()
    return {"accepted": True, "timestamp": current_user.tos_accepted_at.isoformat()}

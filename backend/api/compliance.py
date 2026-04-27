import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.user import User, UserRole
from schemas.compliance import (
    ComplianceEvaluationResult,
    ComplianceProfileRead,
    DocumentRead,
    DocumentReview,
    DocumentUpload,
)
from services import compliance as compliance_service

router = APIRouter(prefix="/compliance", tags=["compliance"])


# ---------------------------------------------------------------------------
# Driver: manage own documents
# ---------------------------------------------------------------------------

@router.post(
    "/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a compliance document (driver)",
)
async def upload_document(
    payload: DocumentUpload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> DocumentRead:
    return await compliance_service.upload_document(db, current_user, payload)


@router.get(
    "/documents",
    response_model=list[DocumentRead],
    summary="List own documents (driver)",
)
async def list_my_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> list[DocumentRead]:
    return await compliance_service.list_driver_documents(db, current_user.id)


@router.get(
    "/profile",
    response_model=ComplianceProfileRead,
    summary="Get own compliance profile and score (driver)",
)
async def get_my_compliance_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> ComplianceProfileRead:
    return await compliance_service.get_driver_profile(db, current_user.id)


# ---------------------------------------------------------------------------
# Admin: review documents and manage drivers
# ---------------------------------------------------------------------------

@router.get(
    "/admin/drivers/{driver_id}/profile",
    response_model=ComplianceProfileRead,
    summary="[Admin] Get compliance profile for any driver",
)
async def admin_get_profile(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> ComplianceProfileRead:
    return await compliance_service.get_driver_profile(db, driver_id)


@router.get(
    "/admin/drivers/{driver_id}/documents",
    response_model=list[DocumentRead],
    summary="[Admin] List all documents for a driver",
)
async def admin_list_documents(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[DocumentRead]:
    return await compliance_service.list_driver_documents(db, driver_id)


@router.patch(
    "/admin/documents/{document_id}/review",
    response_model=DocumentRead,
    summary="[Admin] Approve or reject a document",
)
async def review_document(
    document_id: uuid.UUID,
    payload: DocumentReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
) -> DocumentRead:
    return await compliance_service.review_document(db, document_id, current_user, payload)


@router.post(
    "/admin/drivers/{driver_id}/evaluate",
    response_model=ComplianceEvaluationResult,
    summary="[Admin] Manually trigger compliance re-evaluation for a driver",
)
async def evaluate_driver(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> ComplianceEvaluationResult:
    return await compliance_service.evaluate_driver(db, driver_id)


@router.post(
    "/admin/sweep/expiry",
    response_model=list[ComplianceEvaluationResult],
    summary="[Admin] Run expiry sweep — expire outdated docs and re-evaluate affected drivers",
)
async def run_expiry_sweep(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[ComplianceEvaluationResult]:
    return await compliance_service.run_expiry_sweep(db)

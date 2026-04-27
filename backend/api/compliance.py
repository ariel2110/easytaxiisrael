import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
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
# Driver: onboarding progress bar
# ---------------------------------------------------------------------------

@router.get(
    "/progress",
    summary="סרגל התקדמות — סטטוס כלל שלבי ה-onboarding עבור נהג",
)
async def driver_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> dict:
    """
    Returns a structured progress overview for the driver's onboarding, including:
      - Identity KYC (Persona)
      - Vehicle compliance (photos + Persona vehicle inquiry)
      - Compliance documents score
      - Rideshare acknowledgment (if applicable)

    Response shape:
      {
        "overall_pct": 65,
        "steps": [
          {"id": "identity_kyc", "name": "אימות זהות", "status": "approved", "required": true},
          ...
        ]
      }
    """
    from models.persona import PersonaInquiry, PersonaInquiryStatus
    from models.rideshare import RideshareProfile, RideshareStatus
    from models.vehicle import VehicleCompliance, VehicleComplianceStatus
    from models.compliance import ComplianceStatus

    driver_id = current_user.id
    steps = []

    # 1. Identity KYC
    res = await db.execute(
        select(PersonaInquiry)
        .where(PersonaInquiry.driver_id == driver_id)
        .order_by(PersonaInquiry.created_at.desc())
        .limit(1)
    )
    kyc = res.scalar_one_or_none()
    if kyc is None:
        kyc_status = "not_started"
    elif kyc.status == PersonaInquiryStatus.approved:
        kyc_status = "approved"
    elif kyc.status in (PersonaInquiryStatus.declined, PersonaInquiryStatus.expired):
        kyc_status = kyc.status.value
    else:
        kyc_status = "pending"
    steps.append({"id": "identity_kyc", "name": "אימות זהות", "status": kyc_status, "required": True})

    # 2. Vehicle compliance
    res = await db.execute(
        select(VehicleCompliance)
        .where(VehicleCompliance.driver_id == driver_id)
        .order_by(VehicleCompliance.created_at.desc())
        .limit(1)
    )
    vc = res.scalar_one_or_none()
    if vc is None:
        vc_status = "not_started"
    elif vc.status == VehicleComplianceStatus.approved:
        vc_status = "approved"
    elif vc.status == VehicleComplianceStatus.rejected:
        vc_status = "rejected"
    else:
        vc_status = "pending"
    steps.append({"id": "vehicle_compliance", "name": "אישור רכב", "status": vc_status, "required": True})

    # 3. Compliance documents
    try:
        profile_read = await compliance_service.get_driver_profile(db, driver_id)
        compliance_status = profile_read.compliance_status.value
    except Exception:
        compliance_status = "not_started"
    steps.append({"id": "compliance_docs", "name": "מסמכי ציות", "status": compliance_status, "required": True})

    # 4. Rideshare acknowledgment (optional — only shown for rideshare drivers)
    if current_user.driver_type is not None:
        res = await db.execute(
            select(RideshareProfile).where(RideshareProfile.driver_id == driver_id)
        )
        rs = res.scalar_one_or_none()
        if rs is None:
            rs_status = "not_started"
        elif rs.status == RideshareStatus.ready:
            rs_status = "approved"
        else:
            rs_status = "pending"
        steps.append({"id": "rideshare_ack", "name": "אישור תנאי שיתוף נסיעות", "status": rs_status, "required": False})

    # Compute overall percentage
    weights = {"not_started": 0, "pending": 0.4, "approved": 1.0, "completed": 1.0, "ready": 1.0}
    required_steps = [s for s in steps if s["required"]]
    optional_steps = [s for s in steps if not s["required"]]
    required_score = sum(weights.get(s["status"], 0) for s in required_steps) / max(len(required_steps), 1)
    optional_score = sum(weights.get(s["status"], 0) for s in optional_steps) / max(len(optional_steps), 1) if optional_steps else 1.0
    overall_pct = int((required_score * 0.85 + optional_score * 0.15) * 100)

    return {"overall_pct": overall_pct, "steps": steps}


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

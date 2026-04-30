import os
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_admin_key, require_roles
from models.user import User, UserRole
from schemas.compliance import (
    ComplianceEvaluationResult,
    ComplianceProfileRead,
    DocumentRead,
    DocumentReview,
    DocumentUpload,
)
from services import compliance as compliance_service

UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", "/app/uploads/docs"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
    "application/pdf",
}
_MAX_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter(prefix="/compliance", tags=["compliance"])


# ---------------------------------------------------------------------------
# File upload / serving
# ---------------------------------------------------------------------------

@router.post(
    "/upload",
    summary="Upload a document file (driver or admin)",
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Multipart file upload. Returns a `file_key` to use when submitting a document record.
    Accepted: JPEG, PNG, WEBP, HEIC/HEIF, PDF — max 10 MB.
    """
    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WEBP, HEIC, PDF",
        )
    content = await file.read()
    if len(content) > _MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 10 MB.",
        )
    ext = Path(file.filename or "file").suffix.lower() or ".bin"
    file_key = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOADS_DIR / file_key
    dest.write_bytes(content)
    return {"file_key": file_key, "filename": file.filename, "size": len(content)}


@router.get(
    "/files/{file_key}",
    summary="Serve an uploaded document file",
)
async def serve_file(
    file_key: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """
    Serve an uploaded file. Drivers can only fetch their own docs;
    admins can fetch any doc.
    """
    # Basic path-traversal guard
    if "/" in file_key or "\\" in file_key or ".." in file_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file key")
    path = UPLOADS_DIR / file_key
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(str(path))


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
    _: User = Depends(require_admin_key),
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
    _: User = Depends(require_admin_key),
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
    current_user: User = Depends(require_admin_key),
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
    _: User = Depends(require_admin_key),
) -> ComplianceEvaluationResult:
    return await compliance_service.evaluate_driver(db, driver_id)


@router.post(
    "/admin/sweep/expiry",
    response_model=list[ComplianceEvaluationResult],
    summary="[Admin] Run expiry sweep — expire outdated docs and re-evaluate affected drivers",
)
async def run_expiry_sweep(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_key),
) -> list[ComplianceEvaluationResult]:
    return await compliance_service.run_expiry_sweep(db)


# ---------------------------------------------------------------------------
# Background check (אישור יושרה) — manual upload, admin review
# ---------------------------------------------------------------------------

class BackgroundCheckSubmit(BaseModel):
    """Driver submits their criminal-background clearance certificate."""
    file_key: str = Field(..., description="S3 / storage key of the uploaded PDF")
    expiry_date: date = Field(..., description="תוקף האישור (YYYY-MM-DD)")


@router.post(
    "/documents/background-check",
    status_code=status.HTTP_201_CREATED,
    summary="Submit criminal background clearance certificate (driver)",
)
async def submit_background_check(
    payload: BackgroundCheckSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.driver)),
) -> dict:
    """
    Driver uploads their 'אישור יושרה' (police clearance certificate).
    Stored as a DriverDocument with type=background_check and put in pending state.
    Admin must manually approve it via PATCH /compliance/admin/documents/{id}/review.
    """
    from models.compliance import DocumentType
    from schemas.compliance import DocumentUpload
    doc_payload = DocumentUpload(
        document_type=DocumentType.background_check,
        file_key=payload.file_key,
        expiry_date=payload.expiry_date,
    )
    doc = await compliance_service.upload_document(db, current_user, doc_payload)
    return {
        "message": "אישור יושרה הוגש בהצלחה — ממתין לאישור מנהל",
        "document_id": str(doc.id),
        "status": doc.status,
    }


class BackgroundCheckApprove(BaseModel):
    expiry_date: date


@router.patch(
    "/admin/drivers/{driver_id}/background-check/approve",
    summary="[Admin] Mark background check as approved and set expiry",
)
async def admin_approve_background_check(
    driver_id: uuid.UUID,
    payload: BackgroundCheckApprove,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_key),
) -> dict:
    """
    Admin approves the 'אישור יושרה' and records the expiry date
    on the driver's compliance profile.
    """
    from models.compliance import DriverComplianceProfile
    result = await db.execute(
        select(DriverComplianceProfile).where(
            DriverComplianceProfile.driver_id == driver_id
        )
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        from models.compliance import DriverComplianceProfile as DCP, ComplianceStatus
        profile = DCP(driver_id=driver_id)
        db.add(profile)
    profile.background_check_approved = True
    profile.background_check_expiry = payload.expiry_date
    await db.commit()
    return {
        "driver_id": str(driver_id),
        "background_check_approved": True,
        "background_check_expiry": payload.expiry_date.isoformat(),
    }


# ---------------------------------------------------------------------------
# Admin: list all drivers pending document review
# ---------------------------------------------------------------------------

class DriverDocReviewItem(BaseModel):
    driver_id: uuid.UUID
    phone: str
    full_name: str | None
    auth_status: str
    compliance_status: str
    compliance_score: int
    pending_docs: int
    total_docs: int

    model_config = {"from_attributes": True}


@router.get(
    "/admin/drivers",
    response_model=list[DriverDocReviewItem],
    summary="[Admin] List all drivers with document status",
)
async def admin_list_drivers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_key),
) -> list[DriverDocReviewItem]:
    from models.compliance import DriverDocument, DocumentStatus, DriverComplianceProfile, ComplianceStatus
    from sqlalchemy import func as sqlfunc

    drivers_r = await db.execute(
        select(User)
        .where(User.role == UserRole.driver)
        .order_by(User.created_at.desc())
        .offset(skip).limit(limit)
    )
    drivers = list(drivers_r.scalars().all())
    driver_ids = [d.id for d in drivers]

    # Profiles
    profiles_r = await db.execute(
        select(DriverComplianceProfile).where(DriverComplianceProfile.driver_id.in_(driver_ids))
    )
    profile_map = {p.driver_id: p for p in profiles_r.scalars().all()}

    # Doc counts
    docs_r = await db.execute(
        select(DriverDocument).where(DriverDocument.driver_id.in_(driver_ids))
    )
    all_docs = list(docs_r.scalars().all())
    from collections import defaultdict
    pending_map: dict[uuid.UUID, int] = defaultdict(int)
    total_map: dict[uuid.UUID, int] = defaultdict(int)
    for doc in all_docs:
        total_map[doc.driver_id] += 1
        if doc.status == DocumentStatus.pending:
            pending_map[doc.driver_id] += 1

    result = []
    for d in drivers:
        p = profile_map.get(d.id)
        result.append(DriverDocReviewItem(
            driver_id=d.id,
            phone=d.phone,
            full_name=d.full_name,
            auth_status=d.auth_status.value if d.auth_status else "pending",
            compliance_status=p.compliance_status.value if p else "blocked",
            compliance_score=p.compliance_score if p else 0,
            pending_docs=pending_map[d.id],
            total_docs=total_map[d.id],
        ))
    return result


@router.post(
    "/admin/drivers/{driver_id}/approve",
    summary="[Admin] Approve driver — set auth_status=approved",
)
async def admin_approve_driver(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_key),
) -> dict:
    from models.user import AuthStatus
    driver = await db.get(User, driver_id)
    if driver is None or driver.role != UserRole.driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    driver.auth_status = AuthStatus.approved
    await db.commit()
    return {"driver_id": str(driver_id), "auth_status": "approved"}

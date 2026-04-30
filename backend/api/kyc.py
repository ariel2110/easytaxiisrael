"""
KYC API — dual-agent driver verification endpoints

Driver routes (require driver auth):
  POST   /kyc/application                     → start or return draft application
  POST   /kyc/application/{app_id}/document   → upload a document (multipart)
  POST   /kyc/application/{app_id}/submit     → trigger agent pipeline
  GET    /kyc/application/status              → driver checks own status

Admin routes (require admin auth):
  GET    /admin/kyc/applications              → list all with optional ?status= filter
  GET    /admin/kyc/applications/{app_id}     → full application detail
  PATCH  /admin/kyc/applications/{app_id}/review  → manual override verdict

Document upload flow:
  1. Client POSTs multipart file to /kyc/application/{id}/document
  2. File is stored locally (UPLOAD_DIR) with a unique key
  3. KYCDocument row is created / replaced
  4. On submit: agents read files via their file_key path
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, Form,
    HTTPException, UploadFile, status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_admin_key, require_roles
from models.kyc_application import (
    KYCApplication,
    KYCApplicationStatus,
    KYCDocument,
    KYCDocumentType,
)
from models.user import User, UserRole
from services import kyc_service

log = logging.getLogger(__name__)

router = APIRouter(tags=["kyc"])

# Directory where uploaded documents are stored inside the container
_UPLOAD_DIR = Path(os.getenv("KYC_UPLOAD_DIR", "/tmp/kyc_uploads"))
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Max file size: 10 MB
_MAX_FILE_BYTES = 10 * 1024 * 1024
_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _app_to_dict(app: KYCApplication, docs: list[KYCDocument] | None = None) -> dict:
    d = {
        "id": str(app.id),
        "driver_id": str(app.driver_id),
        "driver_type": app.driver_type,
        "status": app.status.value,
        "final_verdict": app.final_verdict,
        "compliance_score": app.compliance_score,
        "insurance_covers_rideshare": app.insurance_covers_rideshare,
        "verified_name": app.verified_name,
        "id_number": app.id_number,
        "date_of_birth": app.date_of_birth,
        "license_class": app.license_class,
        "license_expiry": app.license_expiry,
        "rejection_reasons": json.loads(app.rejection_reasons) if app.rejection_reasons else [],
        "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
        "completed_at": app.completed_at.isoformat() if app.completed_at else None,
        "created_at": app.created_at.isoformat(),
    }
    if docs is not None:
        d["documents"] = [
            {
                "id": str(doc.id),
                "document_type": doc.document_type.value,
                "status": doc.status.value,
                "confidence": doc.agent1_confidence,
                "issues": json.loads(doc.agent1_issues) if doc.agent1_issues else [],
                "uploaded_at": doc.uploaded_at.isoformat(),
            }
            for doc in docs
        ]
    return d


def _admin_app_to_dict(app: KYCApplication, docs: list[KYCDocument] | None = None) -> dict:
    """Like _app_to_dict but includes raw agent results for admin view."""
    d = _app_to_dict(app, docs)
    d["agent1_verdict"] = app.agent1_verdict
    d["agent1_model"] = app.agent1_model
    d["agent2_verdict"] = app.agent2_verdict
    d["agent2_model"] = app.agent2_model
    d["admin_notes"] = app.admin_notes
    # Parse agent2 result for admin
    if app.agent2_result:
        try:
            d["agent2_detail"] = json.loads(app.agent2_result)
        except Exception:
            d["agent2_detail"] = None
    return d


# ── Driver routes ─────────────────────────────────────────────────────────────

@router.post("/kyc/application", status_code=status.HTTP_201_CREATED)
async def create_application(
    body: dict,
    current_user: User = Depends(require_roles(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Start a new KYC application (or return existing draft)."""
    driver_type = body.get("driver_type", "rideshare")
    if driver_type not in ("rideshare", "licensed_taxi"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="driver_type must be 'rideshare' or 'licensed_taxi'",
        )

    app = await kyc_service.start_application(db, current_user.id, driver_type)
    docs = await kyc_service.get_documents(db, app.id)
    return _app_to_dict(app, docs)


@router.post("/kyc/application/{app_id}/document", status_code=status.HTTP_200_OK)
async def upload_document(
    app_id: uuid.UUID,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upload a document file for a KYC application."""
    # Validate app belongs to this driver
    app = await db.get(KYCApplication, app_id)
    if not app or app.driver_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.status not in (KYCApplicationStatus.draft, KYCApplicationStatus.resubmit):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot upload to application in status: {app.status.value}",
        )

    # Validate document type
    try:
        doc_type = KYCDocumentType(document_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid document_type: {document_type}",
        )

    # Validate content type
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Allowed: jpeg, png, webp, pdf",
        )

    # Read and size-check
    content = await file.read()
    if len(content) > _MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 10 MB)",
        )

    # Save to disk with unique key
    ext = Path(file.filename or "doc").suffix or ".jpg"
    file_key = f"{app_id}/{doc_type.value}/{uuid.uuid4().hex}{ext}"
    dest = _UPLOAD_DIR / file_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)

    doc = await kyc_service.add_document(db, app_id, doc_type, str(_UPLOAD_DIR / file_key))
    return {
        "document_id": str(doc.id),
        "document_type": doc.document_type.value,
        "status": doc.status.value,
        "message": "Document uploaded successfully",
    }


@router.post("/kyc/application/{app_id}/submit", status_code=status.HTTP_202_ACCEPTED)
async def submit_application(
    app_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Submit application for agent review. Processing starts in the background."""
    try:
        app = await kyc_service.submit_application(db, app_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    # Queue the agent pipeline — runs after response is sent
    background_tasks.add_task(kyc_service.run_agents, db, app_id)

    return {
        "application_id": str(app.id),
        "status": app.status.value,
        "message": "הבקשה התקבלה ונמצאת בבדיקה. תקבל הודעת WhatsApp עם התוצאה.",
    }


@router.get("/kyc/application/status", status_code=status.HTTP_200_OK)
async def get_status(
    current_user: User = Depends(require_roles(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Driver checks own latest KYC application status."""
    app = await kyc_service.get_application(db, current_user.id)
    if not app:
        return {"status": "not_started", "application": None}

    docs = await kyc_service.get_documents(db, app.id)
    return {"status": app.status.value, "application": _app_to_dict(app, docs)}


# ── Admin routes ──────────────────────────────────────────────────────────────

@router.get("/admin/kyc/applications", status_code=status.HTTP_200_OK)
async def admin_list_applications(
    filter_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    _: User = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: list all KYC applications with optional status filter."""
    query = select(KYCApplication).order_by(KYCApplication.created_at.desc())

    if filter_status:
        try:
            status_enum = KYCApplicationStatus(filter_status)
            query = query.where(KYCApplication.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status filter: {filter_status}",
            )

    query = query.limit(min(limit, 200)).offset(offset)
    result = await db.execute(query)
    apps = result.scalars().all()

    return {
        "total": len(apps),
        "applications": [_admin_app_to_dict(a) for a in apps],
    }


@router.get("/admin/kyc/applications/{app_id}", status_code=status.HTTP_200_OK)
async def admin_get_application(
    app_id: uuid.UUID,
    _: User = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: get full application detail including agent raw results."""
    app = await db.get(KYCApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    docs = await kyc_service.get_documents(db, app_id)
    d = _admin_app_to_dict(app, docs)

    # Include full agent1 doc data for admin review
    d["documents_detail"] = []
    for doc in docs:
        doc_d = {
            "id": str(doc.id),
            "document_type": doc.document_type.value,
            "status": doc.status.value,
            "file_key": doc.file_key,
            "confidence": doc.agent1_confidence,
            "issues": json.loads(doc.agent1_issues) if doc.agent1_issues else [],
            "agent1_data": json.loads(doc.agent1_data) if doc.agent1_data else None,
            "uploaded_at": doc.uploaded_at.isoformat(),
        }
        d["documents_detail"].append(doc_d)

    return d


@router.patch("/admin/kyc/applications/{app_id}/review", status_code=status.HTTP_200_OK)
async def admin_review_application(
    app_id: uuid.UUID,
    body: dict,
    admin: User = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: manually override the agent verdict.

    Body: { "verdict": "approve" | "reject", "notes": "..." }
    """
    app = await db.get(KYCApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    verdict = body.get("verdict")
    if verdict not in ("approve", "reject"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="verdict must be 'approve' or 'reject'",
        )

    app.final_verdict = verdict
    app.admin_notes = body.get("notes", "")
    app.reviewed_by = admin.id
    app.completed_at = datetime.utcnow()

    if verdict == "approve":
        app.status = KYCApplicationStatus.approved
    else:
        app.status = KYCApplicationStatus.rejected
        if body.get("rejection_reasons"):
            app.rejection_reasons = json.dumps(
                body["rejection_reasons"], ensure_ascii=False
            )

    await db.commit()

    # Update user auth_status
    from models.user import AuthStatus
    user = await db.get(User, app.driver_id)
    if user:
        user.auth_status = (
            AuthStatus.persona_completed if verdict == "approve" else AuthStatus.blocked
        )
        await db.commit()
        log.info("[kyc admin] override app=%s verdict=%s user=%s", app_id, verdict, user.id)

    return {
        "application_id": str(app.id),
        "status": app.status.value,
        "final_verdict": app.final_verdict,
        "message": "הבקשה עודכנה בהצלחה",
    }

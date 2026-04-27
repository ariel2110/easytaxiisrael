"""
Compliance service.

Scoring algorithm
-----------------
Each required document contributes a weighted score.  Documents with
an expiry date also carry a time-decay factor based on days remaining.

  document_score = base_weight × expiry_factor

  expiry_factor:
    expired or rejected      → 0.0
    pending (not yet reviewed) → 0.4   (uploaded but unverified)
    approved, expires < 15d  → 0.5   (warning zone)
    approved, expires < 30d  → 0.7
    approved, expires < 60d  → 0.85
    approved, no expiry / > 60d remaining → 1.0

Total score = Σ(document_score × weight) / Σ(weight) × 100
Rounded to nearest integer, clamped [0, 100].

Status thresholds
-----------------
  80–100  → approved
  50–79   → warning
  0–49    → blocked  (auto-block applied if was not already blocked)

Auto-block triggers (regardless of score)
------------------------------------------
  • Any REQUIRED document is expired
  • background_check is not approved
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.compliance import (
    ComplianceStatus,
    DocumentStatus,
    DocumentType,
    DriverComplianceProfile,
    DriverDocument,
)
from models.user import User, UserRole
from schemas.compliance import (
    ComplianceEvaluationResult,
    ComplianceProfileRead,
    DocumentReview,
    DocumentSummary,
    DocumentUpload,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Required documents every driver must have
REQUIRED_DOCUMENTS: list[DocumentType] = [
    DocumentType.drivers_license,
    DocumentType.vehicle_registration,
    DocumentType.vehicle_insurance,
    DocumentType.background_check,
    DocumentType.vehicle_inspection,
]

# Relative importance of each document type (must sum to 100 for readability)
_DOCUMENT_WEIGHTS: dict[DocumentType, float] = {
    DocumentType.drivers_license:      25.0,
    DocumentType.vehicle_registration: 20.0,
    DocumentType.vehicle_insurance:    25.0,
    DocumentType.background_check:     20.0,
    DocumentType.vehicle_inspection:   10.0,
    DocumentType.profile_photo:         0.0,   # not scored, but tracked
}

_WARNING_DAYS = 30    # expiry within N days → warning
_CRITICAL_DAYS = 15   # expiry within N days → critical


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> date:
    return _now().date()


# ---------------------------------------------------------------------------
# Expiry helpers
# ---------------------------------------------------------------------------

def _days_until_expiry(expiry: date | None) -> int | None:
    if expiry is None:
        return None
    return (expiry - _today()).days


def _expiry_factor(doc: DriverDocument) -> float:
    """Return a [0.0, 1.0] multiplier based on document state and expiry."""
    if doc.status in (DocumentStatus.rejected, DocumentStatus.expired):
        return 0.0
    if doc.status == DocumentStatus.pending:
        return 0.4

    # Approved from here on
    days = _days_until_expiry(doc.expiry_date)
    if days is None:
        return 1.0      # no expiry date → full credit
    if days < 0:
        return 0.0      # expired
    if days < _CRITICAL_DAYS:
        return 0.5
    if days < _WARNING_DAYS:
        return 0.7
    if days < 60:
        return 0.85
    return 1.0


# ---------------------------------------------------------------------------
# Score calculation
# ---------------------------------------------------------------------------

def _compute_score(docs: list[DriverDocument]) -> int:
    """Compute compliance score [0–100] from a driver's document list."""
    # Use latest document per type
    latest: dict[DocumentType, DriverDocument] = {}
    for doc in docs:
        existing = latest.get(doc.document_type)
        if existing is None or doc.uploaded_at > existing.uploaded_at:
            latest[doc.document_type] = doc

    total_weight = sum(_DOCUMENT_WEIGHTS[dt] for dt in REQUIRED_DOCUMENTS)
    if total_weight == 0:
        return 0

    earned = 0.0
    for doc_type in REQUIRED_DOCUMENTS:
        w = _DOCUMENT_WEIGHTS[doc_type]
        doc = latest.get(doc_type)
        factor = _expiry_factor(doc) if doc else 0.0
        earned += w * factor

    return max(0, min(100, round(earned / total_weight * 100)))


def _status_from_score(score: int) -> ComplianceStatus:
    if score >= 80:
        return ComplianceStatus.approved
    if score >= 50:
        return ComplianceStatus.warning
    return ComplianceStatus.blocked


def _should_auto_block(docs: list[DriverDocument]) -> tuple[bool, str | None]:
    """Return (should_block, reason) based on hard rules."""
    latest: dict[DocumentType, DriverDocument] = {}
    for doc in docs:
        existing = latest.get(doc.document_type)
        if existing is None or doc.uploaded_at > existing.uploaded_at:
            latest[doc.document_type] = doc

    # Background check must be explicitly approved
    bg = latest.get(DocumentType.background_check)
    if bg is None or bg.status != DocumentStatus.approved:
        return True, "Background check is not approved"

    # Any required document expired
    for doc_type in REQUIRED_DOCUMENTS:
        doc = latest.get(doc_type)
        if doc and doc.status == DocumentStatus.approved and doc.expiry_date:
            if _days_until_expiry(doc.expiry_date) is not None and _days_until_expiry(doc.expiry_date) < 0:
                return True, f"{doc_type.value} has expired"

    return False, None


# ---------------------------------------------------------------------------
# Profile helpers
# ---------------------------------------------------------------------------

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


def _build_profile_read(
    profile: DriverComplianceProfile,
    docs: list[DriverDocument],
) -> ComplianceProfileRead:
    latest: dict[DocumentType, DriverDocument] = {}
    for doc in docs:
        existing = latest.get(doc.document_type)
        if existing is None or doc.uploaded_at > existing.uploaded_at:
            latest[doc.document_type] = doc

    summaries = [
        DocumentSummary(
            document_type=doc.document_type,
            status=doc.status,
            expiry_date=doc.expiry_date,
            days_until_expiry=_days_until_expiry(doc.expiry_date),
        )
        for doc in latest.values()
    ]

    missing = [dt for dt in REQUIRED_DOCUMENTS if dt not in latest]

    submitted = [
        dt for dt in REQUIRED_DOCUMENTS
        if dt in latest and latest[dt].status != DocumentStatus.rejected
    ]
    progress_pct = round(len(submitted) / len(REQUIRED_DOCUMENTS) * 100)

    return ComplianceProfileRead(
        driver_id=profile.driver_id,
        compliance_status=profile.compliance_status,
        compliance_score=profile.compliance_score,
        auto_blocked=profile.auto_blocked,
        block_reason=profile.block_reason,
        last_evaluated_at=profile.last_evaluated_at,
        documents=summaries,
        missing_required=missing,
        progress_pct=progress_pct,
    )


# ---------------------------------------------------------------------------
# Core evaluation
# ---------------------------------------------------------------------------

async def evaluate_driver(
    db: AsyncSession, driver_id: uuid.UUID
) -> ComplianceEvaluationResult:
    """
    (Re)compute compliance score, apply status, auto-block if needed.
    Updates the driver's `is_active` flag on the User model accordingly.
    """
    result = await db.execute(
        select(DriverDocument).where(DriverDocument.driver_id == driver_id)
    )
    docs = list(result.scalars().all())

    profile = await _get_or_create_profile(db, driver_id)
    prev_status = profile.compliance_status

    score = _compute_score(docs)
    new_status = _status_from_score(score)
    should_block, block_reason = _should_auto_block(docs)

    changes: list[str] = []

    if should_block and new_status != ComplianceStatus.blocked:
        new_status = ComplianceStatus.blocked
        changes.append(f"Auto-blocked: {block_reason}")

    if profile.compliance_score != score:
        changes.append(f"Score: {profile.compliance_score} → {score}")
    if profile.compliance_status != new_status:
        changes.append(f"Status: {profile.compliance_status} → {new_status}")

    profile.compliance_score = score
    profile.compliance_status = new_status
    profile.auto_blocked = should_block
    profile.block_reason = block_reason if should_block else None
    profile.last_evaluated_at = _now()

    # Sync driver active state: blocked → deactivate; approved/warning → activate
    driver = await db.get(User, driver_id)
    if driver and driver.role == UserRole.driver:
        desired_active = new_status != ComplianceStatus.blocked
        if driver.is_active != desired_active:
            driver.is_active = desired_active
            state = "activated" if desired_active else "deactivated"
            changes.append(f"Driver account {state}")

    await db.commit()
    await db.refresh(profile)

    return ComplianceEvaluationResult(
        driver_id=driver_id,
        previous_status=prev_status,
        new_status=new_status,
        score=score,
        auto_blocked=should_block,
        changes=changes,
    )


# ---------------------------------------------------------------------------
# Document CRUD
# ---------------------------------------------------------------------------

async def upload_document(
    db: AsyncSession,
    driver: User,
    payload: DocumentUpload,
) -> DriverDocument:
    doc = DriverDocument(
        driver_id=driver.id,
        document_type=payload.document_type,
        file_key=payload.file_key,
        expiry_date=payload.expiry_date,
        notes=payload.notes,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    # Trigger re-evaluation after upload
    await evaluate_driver(db, driver.id)
    return doc


async def review_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    reviewer: User,
    payload: DocumentReview,
) -> DriverDocument:
    doc = await db.get(DriverDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if payload.status not in (DocumentStatus.approved, DocumentStatus.rejected):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Review status must be 'approved' or 'rejected'",
        )

    doc.status = payload.status
    doc.rejection_reason = payload.rejection_reason
    doc.notes = payload.notes or doc.notes
    doc.reviewed_at = _now()
    doc.reviewed_by = reviewer.id

    await db.commit()
    await db.refresh(doc)
    # Re-evaluate compliance after admin review
    await evaluate_driver(db, doc.driver_id)
    return doc


async def get_driver_profile(
    db: AsyncSession, driver_id: uuid.UUID
) -> ComplianceProfileRead:
    profile = await _get_or_create_profile(db, driver_id)
    result = await db.execute(
        select(DriverDocument).where(DriverDocument.driver_id == driver_id)
    )
    docs = list(result.scalars().all())
    return _build_profile_read(profile, docs)


async def list_driver_documents(
    db: AsyncSession, driver_id: uuid.UUID
) -> list[DriverDocument]:
    result = await db.execute(
        select(DriverDocument)
        .where(DriverDocument.driver_id == driver_id)
        .order_by(DriverDocument.uploaded_at.desc())
    )
    return list(result.scalars().all())


async def run_expiry_sweep(db: AsyncSession) -> list[ComplianceEvaluationResult]:
    """
    Mark all approved documents whose expiry_date has passed as 'expired',
    then re-evaluate those drivers.  Intended for a scheduled background task.
    """
    today = _today()
    result = await db.execute(
        select(DriverDocument).where(
            DriverDocument.status == DocumentStatus.approved,
            DriverDocument.expiry_date < today,
        )
    )
    expired_docs = result.scalars().all()

    affected_drivers: set[uuid.UUID] = set()
    for doc in expired_docs:
        doc.status = DocumentStatus.expired
        affected_drivers.add(doc.driver_id)

    await db.flush()

    evaluation_results: list[ComplianceEvaluationResult] = []
    for driver_id in affected_drivers:
        res = await evaluate_driver(db, driver_id)
        evaluation_results.append(res)

    return evaluation_results

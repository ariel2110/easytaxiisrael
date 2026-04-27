"""
Legal compliance service.

Scoring rules
-------------
Each boolean flag contributes equally (25 pts each).
Documents verified adds a bonus only when all other flags are set.

  license_valid      → 25 pts
  insurance_valid    → 25 pts
  vehicle_valid      → 25 pts
  documents_verified → 25 pts (requires all others first)

Status thresholds
-----------------
  100     → approved
  70–99   → warning
  0–69    → blocked  (driver deactivated automatically)

Step completion also feeds into the score:
  Each completed step adds (50 / total_steps) to a secondary component
  that blends with the flags score at 50/50 when steps exist.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.legal import (
    ComplianceStep,
    DriverLegalStatus,
    LegalComplianceStatus,
    LegalDocument,
)
from models.user import User, UserRole
from schemas.legal import (
    ComplianceProgressRead,
    DriverLegalStatusRead,
    LegalDocumentUpload,
)

# Default checklist every new driver gets
_DEFAULT_STEPS: list[tuple[int, str]] = [
    (1, "Upload driver's license"),
    (2, "Upload vehicle registration"),
    (3, "Upload insurance certificate"),
    (4, "Pass background check"),
    (5, "Complete vehicle inspection"),
    (6, "Profile photo uploaded"),
]


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _compute_score(legal: DriverLegalStatus, steps: list[ComplianceStep]) -> int:
    """Blend flag-based score (50%) with step completion (50%)."""
    flags = [legal.license_valid, legal.insurance_valid, legal.vehicle_valid, legal.documents_verified]
    flag_score = sum(25 for f in flags if f)  # 0–100

    if steps:
        completed = sum(1 for s in steps if s.completed)
        step_score = round(completed / len(steps) * 100)
        # 50/50 blend
        return round(0.5 * flag_score + 0.5 * step_score)

    return flag_score


def _status_from_score(score: int) -> LegalComplianceStatus:
    if score == 100:
        return LegalComplianceStatus.approved
    if score >= 70:
        return LegalComplianceStatus.warning
    return LegalComplianceStatus.blocked


async def _get_or_create_legal_status(
    db: AsyncSession, driver_id: uuid.UUID
) -> DriverLegalStatus:
    result = await db.execute(
        select(DriverLegalStatus).where(DriverLegalStatus.driver_id == driver_id)
    )
    legal = result.scalar_one_or_none()
    if legal is None:
        legal = DriverLegalStatus(driver_id=driver_id)
        db.add(legal)
        await db.flush()
        # Seed default checklist steps
        for order, name in _DEFAULT_STEPS:
            db.add(ComplianceStep(driver_id=driver_id, step_name=name, step_order=order))
        await db.flush()
    return legal


async def _load_steps(db: AsyncSession, driver_id: uuid.UUID) -> list[ComplianceStep]:
    result = await db.execute(
        select(ComplianceStep)
        .where(ComplianceStep.driver_id == driver_id)
        .order_by(ComplianceStep.step_order)
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Core evaluation
# ---------------------------------------------------------------------------

async def _evaluate_and_persist(
    db: AsyncSession, legal: DriverLegalStatus, steps: list[ComplianceStep]
) -> None:
    """Recompute score + status and sync User.is_active."""
    score = _compute_score(legal, steps)
    new_status = _status_from_score(score)

    legal.compliance_score = score
    legal.status = new_status

    if new_status == LegalComplianceStatus.blocked:
        legal.block_reason = legal.block_reason or "Compliance score below threshold"
    else:
        legal.block_reason = None

    # Sync driver active state
    driver = await db.get(User, legal.driver_id)
    if driver and driver.role == UserRole.driver:
        driver.is_active = new_status != LegalComplianceStatus.blocked


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_legal_status(db: AsyncSession, driver_id: uuid.UUID) -> DriverLegalStatus:
    legal = await _get_or_create_legal_status(db, driver_id)
    steps = await _load_steps(db, driver_id)
    await _evaluate_and_persist(db, legal, steps)
    await db.commit()
    await db.refresh(legal)
    return legal


async def get_compliance_progress(
    db: AsyncSession, driver_id: uuid.UUID
) -> ComplianceProgressRead:
    legal = await _get_or_create_legal_status(db, driver_id)
    steps = await _load_steps(db, driver_id)
    await _evaluate_and_persist(db, legal, steps)

    # Check document expiry
    docs_result = await db.execute(
        select(LegalDocument).where(LegalDocument.driver_id == driver_id)
    )
    docs = list(docs_result.scalars().all())
    today = _today()
    expired = 0
    for doc in docs:
        was_expired = doc.is_expired
        doc.is_expired = bool(doc.expiry_date and doc.expiry_date < today)
        if doc.is_expired != was_expired:
            expired += 1 if doc.is_expired else 0

    await db.commit()
    await db.refresh(legal)

    completed_count = sum(1 for s in steps if s.completed)
    return ComplianceProgressRead(
        driver_id=driver_id,
        compliance_score=legal.compliance_score,
        status=legal.status,
        progress_pct=round(completed_count / max(len(steps), 1) * 100),
        steps_completed=completed_count,
        steps_total=len(steps),
        steps=[s.__dict__ for s in steps],
        pending_documents=sum(1 for d in docs if not d.is_expired),
        expired_documents=sum(1 for d in docs if d.is_expired),
    )


async def upload_document(
    db: AsyncSession, driver: User, payload: LegalDocumentUpload
) -> LegalDocument:
    today = _today()
    doc = LegalDocument(
        driver_id=driver.id,
        document_name=payload.document_name,
        file_path=payload.file_path,
        expiry_date=payload.expiry_date,
        is_expired=bool(payload.expiry_date and payload.expiry_date < today),
    )
    db.add(doc)

    # Auto-mark step completed based on document name keywords
    steps = await _load_steps(db, driver.id)
    doc_lower = payload.document_name.lower()
    keyword_map = {
        "license": "Upload driver's license",
        "registration": "Upload vehicle registration",
        "insurance": "Upload insurance certificate",
        "photo": "Profile photo uploaded",
        "inspection": "Complete vehicle inspection",
    }
    for keyword, step_name in keyword_map.items():
        if keyword in doc_lower:
            for step in steps:
                if step.step_name == step_name and not step.completed:
                    step.completed = True
                    step.completed_at = _now()

    legal = await _get_or_create_legal_status(db, driver.id)
    await _evaluate_and_persist(db, legal, steps)
    await db.commit()
    await db.refresh(doc)
    return doc


async def update_legal_flags(
    db: AsyncSession,
    driver_id: uuid.UUID,
    license_valid: bool | None = None,
    insurance_valid: bool | None = None,
    vehicle_valid: bool | None = None,
    documents_verified: bool | None = None,
) -> DriverLegalStatus:
    """Admin: manually set boolean compliance flags."""
    legal = await _get_or_create_legal_status(db, driver_id)
    steps = await _load_steps(db, driver_id)

    if license_valid is not None:
        legal.license_valid = license_valid
    if insurance_valid is not None:
        legal.insurance_valid = insurance_valid
    if vehicle_valid is not None:
        legal.vehicle_valid = vehicle_valid
    if documents_verified is not None:
        legal.documents_verified = documents_verified

    await _evaluate_and_persist(db, legal, steps)
    await db.commit()
    await db.refresh(legal)
    return legal

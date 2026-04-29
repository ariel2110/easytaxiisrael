"""
KYC Orchestration Service — replaces Persona.com

Manages the full two-agent verification pipeline:
  Agent 1 (GPT-4o Vision)  — reads each document image, extracts structured data
  Agent 2 (Claude Haiku)   — cross-validates all docs, applies Israeli transport law

Pipeline:
  start_application() → add_document() × N → submit_application()
    └─ _run_agents_background() [BackgroundTask]
         ├─ Agent 1: analyse each doc image individually
         ├─ Agent 2: review all Agent-1 results together
         └─ update KYCApplication + User.auth_status + send WhatsApp notification
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.kyc_application import (
    KYCApplication,
    KYCApplicationStatus,
    KYCDocument,
    KYCDocumentStatus,
    KYCDocumentType,
)
from models.user import AuthStatus, User
from services.agents.kyc_primary import KYCPrimaryAgent
from services.agents.kyc_reviewer import KYCReviewerAgent
from services import whatsapp as wa

log = logging.getLogger(__name__)

_primary = KYCPrimaryAgent()
_reviewer = KYCReviewerAgent()


# ── Public API ───────────────────────────────────────────────────────────────

async def start_application(
    db: AsyncSession,
    driver_id: uuid.UUID,
    driver_type: str,  # "rideshare" | "licensed_taxi"
) -> KYCApplication:
    """Create a new KYC application in draft state.
    If a draft already exists, return it instead of creating a new one.
    """
    existing = await db.execute(
        select(KYCApplication).where(
            KYCApplication.driver_id == driver_id,
            KYCApplication.status == KYCApplicationStatus.draft,
        )
    )
    app = existing.scalar_one_or_none()
    if app:
        return app

    app = KYCApplication(
        driver_id=driver_id,
        driver_type=driver_type,
        status=KYCApplicationStatus.draft,
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    log.info("[kyc] new application id=%s driver=%s type=%s", app.id, driver_id, driver_type)
    return app


async def add_document(
    db: AsyncSession,
    application_id: uuid.UUID,
    doc_type: KYCDocumentType,
    file_key: str,
) -> KYCDocument:
    """Register a document file_key for a KYC application.
    If a document of this type already exists in the application, replace it.
    """
    result = await db.execute(
        select(KYCDocument).where(
            KYCDocument.application_id == application_id,
            KYCDocument.document_type == doc_type,
        )
    )
    doc = result.scalar_one_or_none()

    if doc:
        doc.file_key = file_key
        doc.status = KYCDocumentStatus.pending
        doc.agent1_data = None
        doc.agent1_issues = None
        doc.agent1_confidence = None
    else:
        doc = KYCDocument(
            application_id=application_id,
            document_type=doc_type,
            file_key=file_key,
            status=KYCDocumentStatus.pending,
        )
        db.add(doc)

    await db.commit()
    await db.refresh(doc)
    return doc


async def submit_application(
    db: AsyncSession,
    application_id: uuid.UUID,
    driver_id: uuid.UUID,
) -> KYCApplication:
    """Mark application as submitted. Returns updated application.
    The actual agent pipeline must be triggered via BackgroundTasks AFTER this call.
    """
    app = await db.get(KYCApplication, application_id)
    if not app or app.driver_id != driver_id:
        raise ValueError("Application not found")

    if app.status not in (KYCApplicationStatus.draft, KYCApplicationStatus.resubmit):
        raise ValueError(f"Cannot submit application in status: {app.status}")

    app.status = KYCApplicationStatus.submitted
    app.submitted_at = datetime.utcnow()
    await db.commit()
    await db.refresh(app)
    return app


async def get_application(
    db: AsyncSession,
    driver_id: uuid.UUID,
) -> KYCApplication | None:
    """Get the most recent application for a driver (any status)."""
    result = await db.execute(
        select(KYCApplication)
        .where(KYCApplication.driver_id == driver_id)
        .order_by(KYCApplication.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_documents(
    db: AsyncSession,
    application_id: uuid.UUID,
) -> list[KYCDocument]:
    result = await db.execute(
        select(KYCDocument).where(KYCDocument.application_id == application_id)
    )
    return list(result.scalars().all())


# ── Agent Pipeline (runs as BackgroundTask) ──────────────────────────────────

async def run_agents(
    db: AsyncSession,
    application_id: uuid.UUID,
) -> None:
    """
    Full two-agent KYC pipeline. Called as a FastAPI BackgroundTask.

    1. Load application + documents
    2. Agent 1: analyse each document image (GPT-4o Vision)
    3. Agent 2: review all results (Claude — Israeli law compliance)
    4. Compare verdicts → final decision
    5. Update User.auth_status
    6. Send WhatsApp notification to driver
    """
    app = await db.get(KYCApplication, application_id)
    if not app:
        log.error("[kyc] run_agents: application %s not found", application_id)
        return

    # Set status to processing
    app.status = KYCApplicationStatus.processing
    await db.commit()

    docs_result = await db.execute(
        select(KYCDocument).where(KYCDocument.application_id == application_id)
    )
    docs: list[KYCDocument] = list(docs_result.scalars().all())

    # ── Agent 1: process each document ────────────────────────────────────
    agent1_all: dict[str, dict] = {}
    agent1_failed = False

    for doc in docs:
        log.info("[kyc] Agent 1 analysing doc=%s type=%s", doc.id, doc.document_type)
        result = await _primary.run({
            "document_type": doc.document_type.value,
            "file_key": doc.file_key,
            "application_id": str(application_id),
        })

        doc.agent1_data = json.dumps(result.data, ensure_ascii=False)
        doc.agent1_confidence = result.data.get("confidence", 0)
        doc.agent1_issues = json.dumps(result.data.get("issues", []), ensure_ascii=False)
        doc.status = KYCDocumentStatus.analysed

        if result.success:
            agent1_all[doc.document_type.value] = result.data
        else:
            agent1_failed = True
            agent1_all[doc.document_type.value] = result.data
            log.warning("[kyc] Agent 1 issue: doc=%s issues=%s", doc.id, result.data.get("issues"))

    await db.commit()

    # Store Agent 1 summary on the application
    app.agent1_result = json.dumps(agent1_all, ensure_ascii=False)
    app.agent1_verdict = "reject" if agent1_failed else "approve"
    app.agent1_model = "gpt-4o"

    # ── Agent 2: compliance review ─────────────────────────────────────────
    log.info("[kyc] Agent 2 reviewing application=%s", application_id)
    review_result = await _reviewer.run({
        "driver_type": app.driver_type,
        "documents": agent1_all,
        "application_id": str(application_id),
    })

    app.agent2_result = json.dumps(review_result.data, ensure_ascii=False)
    app.agent2_verdict = review_result.data.get("verdict", "manual_review")
    app.agent2_model = review_result.model_used

    # ── Extract summary fields ─────────────────────────────────────────────
    summary = review_result.data.get("extracted_summary", {})
    if summary:
        app.verified_name = summary.get("full_name")
        app.id_number = summary.get("id_number")
        app.date_of_birth = summary.get("dob")
        app.license_class = summary.get("license_class")
        app.license_expiry = summary.get("license_expiry")

    app.insurance_covers_rideshare = bool(review_result.data.get("insurance_covers_rideshare", False))
    app.compliance_score = review_result.data.get("compliance_score", 0)

    # ── Final decision ─────────────────────────────────────────────────────
    a1 = app.agent1_verdict   # "approve" | "reject"
    a2 = app.agent2_verdict   # "approve" | "reject" | "manual_review"

    blocking = review_result.data.get("blocking_issues", [])
    warnings = review_result.data.get("warnings", [])

    if a2 == "approve" and not blocking:
        final = "approve"
        app.status = KYCApplicationStatus.approved
    elif a2 == "reject" or blocking:
        final = "reject"
        app.status = KYCApplicationStatus.rejected
        app.rejection_reasons = json.dumps(
            [b.get("issue", "") for b in blocking], ensure_ascii=False
        )
    else:
        # manual_review or agents disagree
        final = "manual_review"
        app.status = KYCApplicationStatus.needs_review

    app.final_verdict = final
    app.completed_at = datetime.utcnow()
    await db.commit()

    log.info(
        "[kyc] application=%s final=%s score=%s a1=%s a2=%s blocking=%d warnings=%d",
        application_id, final, app.compliance_score, a1, a2, len(blocking), len(warnings)
    )

    # ── Update User.auth_status ────────────────────────────────────────────
    user = await db.get(User, app.driver_id)
    if user:
        if final == "approve":
            user.auth_status = AuthStatus.persona_completed  # reuse existing "verified" status
        elif final == "reject":
            user.auth_status = AuthStatus.blocked
        # manual_review: leave as persona_in_progress until admin reviews
        else:
            user.auth_status = AuthStatus.persona_in_progress
        await db.commit()
        log.info("[kyc] updated user=%s auth_status=%s", user.id, user.auth_status)

    # ── WhatsApp notification ──────────────────────────────────────────────
    if user:
        await _notify_driver(user.phone, final, blocking, warnings, app.compliance_score)


async def _notify_driver(
    phone: str,
    verdict: str,
    blocking: list[dict],
    warnings: list[dict],
    score: int,
) -> None:
    if verdict == "approve":
        msg = (
            "✅ *אימות הושלם בהצלחה!*\n\n"
            "מסמכיך נבדקו ואושרו. חשבונך פעיל ואתה יכול להתחיל לקבל נסיעות.\n"
            "ברוך הבא לצוות EasyTaxi! 🚕"
        )
    elif verdict == "reject":
        reasons = "\n".join(f"• {b.get('issue', b)}" for b in blocking) if blocking else "• בעיה במסמכים"
        msg = (
            "❌ *הבקשה נדחתה*\n\n"
            f"לצערנו לא ניתן לאשר את בקשתך בשלב זה.\n\n"
            f"*סיבות הדחייה:*\n{reasons}\n\n"
            "לפרטים נוספים צור קשר עם התמיכה."
        )
    else:
        msg = (
            "⏳ *הבקשה נמצאת בבדיקה*\n\n"
            "המסמכים שלך הועברו לבדיקה ידנית על ידי הצוות שלנו.\n"
            "נעדכן אותך בהקדם האפשרי."
        )

    try:
        await wa.send_text(phone, msg)
        log.info("[kyc] WhatsApp notification sent to phone=%s verdict=%s", phone, verdict)
    except Exception as exc:
        log.warning("[kyc] WhatsApp notification failed: %s", exc)

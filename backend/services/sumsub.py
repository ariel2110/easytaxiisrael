"""
Sumsub KYC service — replaces Persona.com

Two verification levels (per Israeli law):
  Israel_Taxi_Driver_Verification  — rideshare drivers  (נהג שיתופי)
  Taxi_Driver_Permit               — licensed taxi       (נהג מונית)

Flow:
  1. create_applicant()    — POST /resources/applicants, store sumsub_applicant_id
  2. get_access_token()    — POST /resources/accessTokens → frontend WebSDK token
  3. process_webhook()     — applicantReviewed event → update user.auth_status
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.sumsub import SumsubApplicant, SumsubStatus
from models.user import AuthStatus, User

log = logging.getLogger(__name__)

_BASE_URL = "https://api.sumsub.com"

# Level name per driver type
LEVEL_RIDESHARE = "Israel_Taxi_Driver_Verification"
LEVEL_TAXI      = "Taxi_Driver_Permit"


# ── HMAC request signing ──────────────────────────────────────────────────────

def _sign(method: str, path: str, body: bytes = b"") -> dict[str, str]:
    """Build Sumsub-required HMAC-SHA256 auth headers."""
    ts = str(int(time.time()))
    msg = ts.encode() + method.upper().encode() + path.encode() + body
    sig = hmac.new(
        settings.SUMSUB_SECRET_KEY.encode(),
        msg,
        hashlib.sha256,
    ).hexdigest()
    return {
        "X-App-Token":      settings.SUMSUB_APP_TOKEN,
        "X-App-Access-Sig": sig,
        "X-App-Access-Ts":  ts,
        "Content-Type":     "application/json",
    }


async def _request(
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
    params: dict | None = None,
) -> dict | None:
    body_bytes = json.dumps(json_body).encode() if json_body else b""
    # Build path with query string for signing
    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        sign_path = f"{path}?{qs}"
    else:
        sign_path = path

    headers = _sign(method, sign_path, body_bytes)
    url = _BASE_URL + sign_path

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.request(
                method,
                url,
                headers=headers,
                content=body_bytes if body_bytes else None,
            )
            if r.status_code >= 400:
                log.warning("[sumsub] %s %s → %s: %s", method, path, r.status_code, r.text[:200])
                return None
            return r.json()
    except Exception as exc:
        log.error("[sumsub] request failed: %s", exc)
        return None


# ── Applicant management ──────────────────────────────────────────────────────

async def create_applicant(
    db: AsyncSession,
    driver_id: str,
    phone: str,
    driver_type: str,  # "rideshare" | "licensed_taxi"
) -> SumsubApplicant | None:
    """Create a Sumsub applicant and persist to DB. Returns existing if already created."""
    level_name = LEVEL_TAXI if driver_type == "licensed_taxi" else LEVEL_RIDESHARE

    # Return existing applicant if present (but not if rejected — allow retry)
    existing = await db.execute(
        select(SumsubApplicant).where(
            SumsubApplicant.driver_id == driver_id,
            SumsubApplicant.level_name == level_name,
            SumsubApplicant.status != SumsubStatus.rejected,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        return row

    result = await _request(
        "POST",
        "/resources/applicants",
        params={"levelName": level_name},
        json_body={
            "externalUserId": str(driver_id),
            "phone": phone,
        },
    )
    if not result:
        return None

    applicant_id = result.get("id")
    if not applicant_id:
        log.error("[sumsub] create_applicant: no id in response: %s", result)
        return None

    row = SumsubApplicant(
        driver_id=driver_id,
        sumsub_applicant_id=applicant_id,
        level_name=level_name,
        status=SumsubStatus.init,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    log.info("[sumsub] applicant created: driver=%s applicant=%s level=%s", driver_id, applicant_id, level_name)
    return row


async def get_access_token(
    external_user_id: str,
    level_name: str,
    ttl_secs: int = 3600,
) -> str | None:
    """Generate a short-lived WebSDK access token.

    IMPORTANT: `userId` must be the externalUserId (our driver UUID), NOT the
    Sumsub internal applicant id. Passing the internal id causes Sumsub to
    create a shadow applicant whose webhooks won't match our DB records.
    """
    result = await _request(
        "POST",
        "/resources/accessTokens",
        params={
            "userId": external_user_id,
            "levelName": level_name,
            "ttlInSecs": str(ttl_secs),
        },
    )
    if not result:
        return None
    token = result.get("token")
    log.info("[sumsub] access token generated for external_user=%s", external_user_id)
    return token


async def get_or_create_token(
    db: AsyncSession,
    driver_id: str,
    phone: str,
    driver_type: str,
) -> tuple[str | None, str]:
    """End-to-end: ensure applicant exists, return fresh SDK token + level name."""
    level_name = LEVEL_TAXI if driver_type == "licensed_taxi" else LEVEL_RIDESHARE

    applicant = await create_applicant(db, driver_id, phone, driver_type)
    if not applicant:
        return None, level_name

    # Pass driver_id (externalUserId) — NOT the internal Sumsub applicant id
    token = await get_access_token(driver_id, level_name)
    return token, level_name


async def get_applicant_info(sumsub_applicant_id: str) -> dict | None:
    """Fetch applicant personal data from Sumsub API (name, DOB, ID, etc.)."""
    return await _request("GET", f"/resources/applicants/{sumsub_applicant_id}/one")


# ── Webhook verification & processing ────────────────────────────────────────

def verify_webhook_signature(payload_bytes: bytes, digest_header: str) -> bool:
    """Verify Sumsub webhook payload using HMAC-SHA1."""
    expected = hmac.new(
        settings.SUMSUB_SECRET_KEY.encode(),
        payload_bytes,
        hashlib.sha1,
    ).hexdigest()
    return hmac.compare_digest(expected, digest_header.lower())


async def process_webhook(db: AsyncSession, payload: dict) -> None:
    """Handle Sumsub webhook events and update driver status."""
    event_type = payload.get("type", "")
    review_result = payload.get("reviewResult", {})
    applicant_id = payload.get("applicantId", "")
    external_user_id = payload.get("externalUserId", "")  # our driver UUID

    log.info("[sumsub] webhook type=%s applicant=%s user=%s", event_type, applicant_id, external_user_id)

    HANDLED_TYPES = {
        "applicantCreated",
        "applicantPending",
        "applicantReviewed",
        "applicantOnHold",
        "applicantReset",
        "applicantStepsReset",
        "applicantWorkflowCompleted",
        "applicantPersonalDataDeleted",
        "applicantAwaitingUser",
    }
    if event_type not in HANDLED_TYPES:
        return

    # Find applicant row — first by Sumsub applicant id, then by our driver UUID
    result = await db.execute(
        select(SumsubApplicant).where(
            SumsubApplicant.sumsub_applicant_id == applicant_id
        )
    )
    applicant = result.scalar_one_or_none()

    # Fallback: look up by externalUserId (our driver UUID) if ID doesn't match
    # This can happen when an old token was generated with the wrong userId param.
    if not applicant and external_user_id:
        try:
            from uuid import UUID
            driver_uuid = UUID(external_user_id)
            fb = await db.execute(
                select(SumsubApplicant)
                .where(SumsubApplicant.driver_id == driver_uuid)
                .order_by(SumsubApplicant.created_at.desc())
                .limit(1)
            )
            applicant = fb.scalar_one_or_none()
            if applicant:
                # Sync the stored applicant_id to the one Sumsub is now using
                log.info(
                    "[sumsub] webhook id mismatch — updating stored id %s → %s for driver %s",
                    applicant.sumsub_applicant_id, applicant_id, external_user_id,
                )
                applicant.sumsub_applicant_id = applicant_id
                await db.flush()  # persist before further updates
        except Exception as exc:
            log.warning("[sumsub] fallback lookup error: %s", exc)

    if not applicant:
        log.warning("[sumsub] webhook: applicant %s not found in DB (type=%s)", applicant_id, event_type)
        return

    review_answer = review_result.get("reviewAnswer", "")  # GREEN | RED
    reject_labels = review_result.get("rejectLabels", [])
    # Also capture risk labels from riskLabels.crossCheck (e.g. manyAccountDuplicates)
    risk_labels_obj = payload.get("riskLabels") or {}
    cross_check_labels = risk_labels_obj.get("crossCheck", [])
    all_labels = list({*reject_labels, *cross_check_labels})

    # ── Update applicant status ──────────────────────────────────────────
    if event_type in ("applicantReset", "applicantStepsReset"):
        applicant.status = SumsubStatus.init
        applicant.review_result = None
        applicant.reject_labels = None

    elif event_type in ("applicantPending", "applicantAwaitingUser"):
        applicant.status = SumsubStatus.pending

    elif event_type == "applicantOnHold":
        applicant.status = SumsubStatus.on_hold

    elif event_type in ("applicantReviewed", "applicantWorkflowCompleted"):
        if review_answer == "GREEN":
            applicant.status = SumsubStatus.completed
            applicant.review_result = "GREEN"
            if all_labels:
                applicant.reject_labels = json.dumps(all_labels, ensure_ascii=False)
        elif review_answer == "RED":
            applicant.status = SumsubStatus.rejected
            applicant.review_result = "RED"
            applicant.reject_labels = json.dumps(all_labels, ensure_ascii=False)

    elif event_type == "applicantPersonalDataDeleted":
        # Sumsub deleted the data — mark as rejected so we don't show stale info
        applicant.status = SumsubStatus.rejected
        applicant.review_result = "DELETED"

    applicant.updated_at = datetime.utcnow()
    await db.commit()

    # ── Update user.auth_status ──────────────────────────────────────────
    user = await db.get(User, applicant.driver_id)
    if not user:
        return

    if event_type in ("applicantReviewed", "applicantWorkflowCompleted"):
        if review_answer == "GREEN":
            user.auth_status = AuthStatus.persona_completed
            log.info("[sumsub] driver=%s APPROVED", user.id)
        elif review_answer == "RED":
            user.auth_status = AuthStatus.blocked
            log.info("[sumsub] driver=%s REJECTED labels=%s", user.id, reject_labels)
        await db.commit()

    elif event_type in ("applicantReset", "applicantStepsReset"):
        # Allow driver to re-verify — revert from blocked if previously blocked by sumsub
        if user.auth_status == AuthStatus.blocked:
            user.auth_status = AuthStatus.whatsapp_verified
            await db.commit()
        log.info("[sumsub] driver=%s applicant RESET — can re-verify", user.id)

    # ── WhatsApp notification ─────────────────────────────────────────────
    from services import whatsapp as wa
    try:
        if event_type in ("applicantReviewed", "applicantWorkflowCompleted"):
            if review_answer == "GREEN":
                msg = (
                    "✅ *האימות שלך הושלם בהצלחה!*\n\n"
                    "מסמכיך אומתו ואושרו. חשבונך פעיל ואתה יכול להתחיל לקבל נסיעות.\n"
                    "ברוך הבא לצוות EasyTaxi! 🚕"
                )
            else:
                reasons = "\n".join(f"• {r}" for r in reject_labels) if reject_labels else "• בעיה במסמכים"
                msg = (
                    "❌ *הבקשה נדחתה*\n\n"
                    f"לצערנו לא ניתן לאשר את בקשתך בשלב זה.\n\n"
                    f"*סיבות:*\n{reasons}\n\n"
                    "תוכל לנסות שוב — היכנס לאפליקציה ולחץ על 'נסה שוב'."
                )
            await wa.send_text(user.phone, msg)

        elif event_type in ("applicantReset", "applicantStepsReset"):
            msg = (
                "🔄 *תהליך האימות אופס*\n\n"
                "תוכל לפתוח מחדש את תהליך האימות דרך האפליקציה."
            )
            await wa.send_text(user.phone, msg)

        elif event_type == "applicantOnHold":
            msg = (
                "🔒 *האימות שלך הועבר לבדיקה ידנית*\n\n"
                "צוות Sumsub בוחן את המסמכים שלך. נעדכן אותך בקרוב."
            )
            await wa.send_text(user.phone, msg)

    except Exception as exc:
        log.warning("[sumsub] WhatsApp notification failed: %s", exc)

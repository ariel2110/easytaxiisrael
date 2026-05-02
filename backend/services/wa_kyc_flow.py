"""
WhatsApp-driven KYC document collection flow.

After Sumsub verifies driving_license + selfie (Israel_Taxi_Driver_Verification),
the driver uploads additional required documents via WhatsApp.
Each photo is scanned by GPT-4o Vision (Agent 1).
When all docs are collected, Claude Haiku (Agent 2) cross-validates them
against Israeli law AND against the identity data verified by Sumsub.

Document requirements per driver type:
  Rideshare (נהג שיתופי):
    1. vehicle_insurance    — ביטוח כולל הסעת נוסעים בשכר  ← CRITICAL
    2. police_clearance     — אישור יושרה ממשטרה (max 3 years)
    3. vehicle_registration — רישוי רכב

  Licensed Taxi (נהג מונית):
    Same 3 PLUS:
    4. professional_license — רישיון נהג מקצועי D
    5. taxi_badge           — רישיון מונית / טאבו
    6. vehicle_inspection   — טסט תקופתי
    7. medical_clearance    — אישור רופא מוסמך

Redis state key: wa_kyc_state:{phone}  TTL 72 h
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from core.redis import redis_client
from models.kyc_application import (
    KYCApplication,
    KYCApplicationStatus,
    KYCDocument,
    KYCDocumentStatus,
    KYCDocumentType,
)
from models.user import AuthStatus, User
from services import kyc_service
from services.agents.kyc_primary import KYCPrimaryAgent
from services.agents.kyc_reviewer import KYCReviewerAgent

log = logging.getLogger(__name__)

_primary = KYCPrimaryAgent()
_reviewer = KYCReviewerAgent()

_UPLOAD_DIR = Path(os.getenv("KYC_UPLOAD_DIR", "/tmp/kyc_uploads"))
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_KYC_STATE_TTL = 72 * 3600   # 72 hours — driver has 3 days to complete

# ── Document sequences per driver type ────────────────────────────────────────

_DOCS_RIDESHARE = [
    "vehicle_insurance",
    "police_clearance",
    "vehicle_registration",
]

_DOCS_TAXI = [
    "vehicle_insurance",
    "police_clearance",
    "vehicle_registration",
    "professional_license",
    "taxi_badge",
    "vehicle_inspection",
    "medical_clearance",
]

_DOC_LABELS = {
    "vehicle_insurance":    "ביטוח רכב",
    "police_clearance":     "אישור יושרה",
    "vehicle_registration": "רישוי רכב",
    "professional_license": "רישיון נהג מקצועי",
    "taxi_badge":           "רישיון מונית",
    "vehicle_inspection":   "טסט תקופתי",
    "medical_clearance":    "אישור רפואי",
}

# ── Document request messages (Hebrew) ────────────────────────────────────────

_DOC_MESSAGES: dict[str, str] = {
    "vehicle_insurance": (
        "📋 *שלב: ביטוח רכב*\n\n"
        "שלח/י תמונה ברורה של *פוליסת הביטוח* שלך (עמוד ראשון עם פרטי הכיסוי).\n\n"
        "⚠️ *חשוב*: הביטוח חייב לכלול כיסוי *הסעת נוסעים בשכר* — ללא זה לא ניתן לאשר.\n\n"
        "📸 _צלם/י ישירות עם הטלפון — וודא שהתמונה ברורה וכל הטקסט נקרא._"
    ),
    "police_clearance": (
        "📋 *שלב: אישור יושרה ממשטרה*\n\n"
        "שלח/י תמונה של *אישור יושרה* ממשטרת ישראל.\n\n"
        "⚠️ האישור חייב להיות *לא יותר מ-3 שנים* ממועד הוצאתו.\n\n"
        "📌 אין לך? הזמן ב: https://www.gov.il/he/service/police_clearance\n\n"
        "📸 _צלם/י את האישור כולו — כולל תאריך ועם חתימה/חותמת._"
    ),
    "vehicle_registration": (
        "📋 *שלב: רישוי רכב*\n\n"
        "שלח/י תמונה של *רישיון הרכב* (הכרטיס הסגול).\n\n"
        "📸 _צלם/י את שני הצדדים אם ניתן — ווידא שמספר הרכב וכל הפרטים ברורים._"
    ),
    "professional_license": (
        "📋 *שלב: רישיון נהיגה מקצועי (D)*\n\n"
        "שלח/י תמונה של *רישיון הנהיגה המקצועי* שלך (רישיון D).\n\n"
        "⚠️ רישיון כיתה D בתוקף הוא חובה לנהגי מונית.\n\n"
        "📸 _צלם/י את הרישיון כולו — חייב להיות בתוקף._"
    ),
    "taxi_badge": (
        "📋 *שלב: רישיון מונית*\n\n"
        "שלח/י תמונה של *רישיון המונית* שלך (טאבו / רישיון הפעלה ממשרד התחבורה).\n\n"
        "📸 _צלם/י בצורה ישרה — ווידא שמספר הרישיון ותאריך תפוגה ברורים._"
    ),
    "vehicle_inspection": (
        "📋 *שלב: טסט תקופתי*\n\n"
        "שלח/י תמונה של *תעודת הטסט התקופתי* של הרכב.\n\n"
        "⚠️ הטסט חייב להיות בתוקף — טסט שפג = הרכב אינו כשיר לנסיעה.\n\n"
        "📸 _צלם/י את המדבקה מחלון הרכב או את המסמך עצמו._"
    ),
    "medical_clearance": (
        "📋 *שלב: אישור רפואי*\n\n"
        "שלח/י תמונה של *האישור הרפואי* לנהיגה מסחרית.\n\n"
        "האישור צריך להיות מרופא מוסמך מטעם משרד הבריאות לנהיגה מסחרית.\n\n"
        "📸 _צלם/י את האישור כולו עם שם הרופא, חתימה ותאריך._"
    ),
}

_INTRO_RIDESHARE = (
    "✅ *אימות הזהות הצליח!*\n\n"
    "השלב הבא: *בדיקת מסמכי רכב ופנקס נהג*\n\n"
    "━━━━━━━━━━━━━━\n"
    "📋 *מסמכים נדרשים (3 סה\"כ):*\n"
    "1️⃣ ביטוח רכב (כולל הסעת נוסעים בשכר) ⚠️\n"
    "2️⃣ אישור יושרה ממשטרה\n"
    "3️⃣ רישוי רכב\n"
    "━━━━━━━━━━━━━━\n\n"
    "🤖 *הבוט סורק כל מסמך אוטומטית ב-AI* — ממוצע 10 שניות לסריקה.\n"
    "📸 שלח/י כל מסמך בתמונה ברורה ישירות לכאן.\n\n"
    "נתחיל עם המסמך הראשון:"
)

_INTRO_TAXI = (
    "✅ *אימות הזהות הצליח!*\n\n"
    "השלב הבא: *בדיקת מסמכי נהג מונית מורשה*\n\n"
    "━━━━━━━━━━━━━━\n"
    "📋 *מסמכים נדרשים (7 סה\"כ):*\n"
    "1️⃣ ביטוח רכב (כולל הסעת נוסעים בשכר) ⚠️\n"
    "2️⃣ אישור יושרה ממשטרה\n"
    "3️⃣ רישוי רכב\n"
    "4️⃣ רישיון נהיגה מקצועי (D)\n"
    "5️⃣ רישיון מונית / טאבו\n"
    "6️⃣ טסט תקופתי\n"
    "7️⃣ אישור רפואי\n"
    "━━━━━━━━━━━━━━\n\n"
    "🤖 *הבוט סורק כל מסמך אוטומטית ב-AI* — ממוצע 10 שניות לסריקה.\n"
    "📸 שלח/י כל מסמך בתמונה ברורה ישירות לכאן.\n\n"
    "נתחיל עם המסמך הראשון:"
)


def _state_key(phone: str) -> str:
    return f"wa_kyc_state:{phone}"


# ── Public API ─────────────────────────────────────────────────────────────────

async def start_doc_collection(
    db: AsyncSession,
    user: User,
    driver_type: str,
    sumsub_data: dict,
) -> None:
    """
    Start WhatsApp document collection after Sumsub verifies identity.
    Called by the Sumsub webhook on applicantReviewed (GREEN).
    Sets user.auth_status = docs_collecting and sends the first document request.
    """
    from services import whatsapp as wa

    doc_list = _DOCS_TAXI if driver_type == "licensed_taxi" else _DOCS_RIDESHARE

    # Create KYC application (or reuse existing draft)
    app = await kyc_service.start_application(db, user.id, driver_type)

    # Build Redis state
    state: dict = {
        "application_id": str(app.id),
        "driver_type":    driver_type,
        "driver_id":      str(user.id),
        # Sumsub-verified identity fields (used for cross-validation)
        "sumsub_name":          sumsub_data.get("full_name") or user.full_name or "",
        "sumsub_id":            sumsub_data.get("id_number") or "",
        "sumsub_license_class": sumsub_data.get("license_class") or "",
        "sumsub_dob":           sumsub_data.get("dob") or "",
        # Collection progress
        "current_doc":  doc_list[0],
        "pending_docs": doc_list[1:],
        "collected_docs": {},   # {doc_type: {confidence, data, issues}}
        "retry_count":    0,
        "awaiting_image": True,
    }
    await redis_client.set(
        _state_key(user.phone),
        json.dumps(state, ensure_ascii=False),
        ex=_KYC_STATE_TTL,
    )

    user.auth_status = AuthStatus.docs_collecting
    await db.commit()

    intro = _INTRO_TAXI if driver_type == "licensed_taxi" else _INTRO_RIDESHARE
    await wa.send_text(user.phone, intro)
    await wa.send_text(user.phone, _DOC_MESSAGES[doc_list[0]])

    log.info(
        "[wa_kyc] started doc collection driver=%s type=%s app=%s",
        user.id, driver_type, app.id,
    )


async def is_in_collection(phone: str) -> bool:
    """True if this phone is currently awaiting a KYC document image."""
    raw = await redis_client.get(_state_key(phone))
    if not raw:
        return False
    state = json.loads(raw)
    return bool(state.get("awaiting_image"))


async def handle_wa_image(
    db: AsyncSession,
    phone: str,
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
) -> bool:
    """
    Process an image sent by a driver during WhatsApp document collection.
    Returns True  — image was handled as KYC (caller must NOT route to support bot).
    Returns False — phone is not in doc collection mode (caller may handle normally).
    """
    raw = await redis_client.get(_state_key(phone))
    if not raw:
        return False

    state: dict = json.loads(raw)
    if not state.get("awaiting_image"):
        return False

    from services import whatsapp as wa

    current_doc = state["current_doc"]
    app_id      = state["application_id"]
    log.info("[wa_kyc] image received doc=%s phone=%s app=%s", current_doc, phone, app_id)

    # ── Save to disk ──────────────────────────────────────────────────────
    ext = ".pdf" if "pdf" in mime_type.lower() else ".jpg"
    file_key = f"{app_id}/{current_doc}/{uuid.uuid4().hex}{ext}"
    dest = _UPLOAD_DIR / file_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(image_bytes)

    # ── Register in KYC application ───────────────────────────────────────
    try:
        doc_type_enum = KYCDocumentType(current_doc)
        await kyc_service.add_document(db, uuid.UUID(app_id), doc_type_enum, str(dest))
    except Exception as exc:
        log.warning("[wa_kyc] add_document failed: %s", exc)

    # ── Agent 1: scan document with GPT-4o Vision ─────────────────────────
    image_b64 = base64.b64encode(image_bytes).decode()
    result = await _primary.run({
        "image_b64":      image_b64,
        "document_type":  current_doc,
        "application_id": app_id,
    })

    confidence = result.data.get("confidence", 0)
    issues     = result.data.get("issues", [])
    is_ok      = result.success and confidence >= 55

    # ── Sumsub cross-validation (name / ID number) ────────────────────────
    mismatch_warn = _check_sumsub_mismatch(current_doc, result.data, state)

    if is_ok and not mismatch_warn:
        # ✅ Document accepted
        state["collected_docs"][current_doc] = {
            "confidence": confidence,
            "data":       result.data,
        }
        state["retry_count"] = 0

        pending = state["pending_docs"]
        if pending:
            state["current_doc"]  = pending[0]
            state["pending_docs"] = pending[1:]
            state["awaiting_image"] = True
            await redis_client.set(_state_key(phone), json.dumps(state, ensure_ascii=False), ex=_KYC_STATE_TTL)

            ok_msg = _accepted_feedback(current_doc, result.data)
            await wa.send_text(phone, ok_msg)
            await wa.send_text(phone, _DOC_MESSAGES[state["current_doc"]])
        else:
            # 🎉 All documents collected — run final AI review
            state["awaiting_image"] = False
            await redis_client.set(_state_key(phone), json.dumps(state, ensure_ascii=False), ex=3600)

            total = len(_DOCS_TAXI if state["driver_type"] == "licensed_taxi" else _DOCS_RIDESHARE)
            await wa.send_text(
                phone,
                f"✅ *כל {total} המסמכים התקבלו!*\n\n"
                "🤖 *הבוט מנתח ומאמת את המסמכים שלך...*\n"
                "כולל השוואה מול נתוני Sumsub המאומתים.\n\n"
                "⏱ זה ייקח כ-30–60 שניות — נשלח לך הודעה בסיום.",
            )
            asyncio.create_task(_finalize_review_task(phone, state))

    elif mismatch_warn:
        # ⚠️ Data mismatch with Sumsub verified identity
        await wa.send_text(phone, mismatch_warn)
        state["retry_count"] = state.get("retry_count", 0) + 1
        if state["retry_count"] >= 3:
            log.warning("[wa_kyc] mismatch after 3 retries doc=%s phone=%s", current_doc, phone)
            state["collected_docs"][current_doc] = {"confidence": 0, "failed": True, "data": {}}
            await _force_advance(db, phone, state, current_doc)
        else:
            await redis_client.set(_state_key(phone), json.dumps(state, ensure_ascii=False), ex=_KYC_STATE_TTL)

    else:
        # ❌ Document not readable / low confidence
        state["retry_count"] = state.get("retry_count", 0) + 1
        if state["retry_count"] >= 3:
            log.warning("[wa_kyc] 3 failures doc=%s phone=%s — advancing", current_doc, phone)
            state["collected_docs"][current_doc] = {"confidence": 0, "failed": True, "data": {}}
            await _force_advance(db, phone, state, current_doc)
        else:
            issue_text = (
                "\n".join(f"• {i}" for i in issues)
                if issues
                else "• לא ניתן לקרוא את המסמך"
            )
            retry_msg = (
                f"⚠️ *לא הצלחנו לאמת את המסמך* (ניסיון {state['retry_count']}/3)\n\n"
                f"בעיות שזוהו:\n{issue_text}\n\n"
                "אנא שלח/י שוב תמונה *ברורה* יותר:\n"
                "• תאורה טובה\n"
                "• מסמך ישר בפריים\n"
                "• כל הטקסט נקרא"
            )
            await wa.send_text(phone, retry_msg)
            await redis_client.set(_state_key(phone), json.dumps(state, ensure_ascii=False), ex=_KYC_STATE_TTL)

    return True


# ── Internal helpers ───────────────────────────────────────────────────────────

def _check_sumsub_mismatch(doc_type: str, agent1_data: dict, state: dict) -> str | None:
    """
    Cross-validate Agent 1 extracted data against Sumsub-verified identity.
    Returns a Hebrew warning string if a significant mismatch is found, else None.
    """
    sumsub_name = (state.get("sumsub_name") or "").strip().lower()
    sumsub_id   = (state.get("sumsub_id")   or "").strip()

    # Name check — docs that should bear the driver's name
    name_docs = {
        "vehicle_insurance", "police_clearance",
        "professional_license", "taxi_badge", "medical_clearance",
    }
    if doc_type in name_docs and sumsub_name:
        holder = (agent1_data.get("holder_name") or "").strip().lower()
        if holder and not _names_match(sumsub_name, holder):
            return (
                f"⚠️ *שם לא תואם*\n\n"
                f"שם על המסמך: *{agent1_data.get('holder_name', '?')}*\n"
                f"שם שאומת ב-Sumsub: *{state.get('sumsub_name', '?')}*\n\n"
                "המסמך חייב להיות על שמך.\n"
                "אם יש שגיאה — שלח/י שוב."
            )

    # ID number check — police clearance should match Sumsub ID
    if doc_type == "police_clearance" and sumsub_id:
        doc_id = (agent1_data.get("document_number") or "").strip()
        if doc_id and doc_id.replace("-", "") != sumsub_id.replace("-", ""):
            return (
                f"⚠️ *מספר זהות לא תואם*\n\n"
                f"מספר זהות על האישור: *{doc_id}*\n"
                f"מספר זהות שאומת: *{sumsub_id}*\n\n"
                "ודא שזה האישור שלך ושלח/י שוב."
            )

    return None


def _names_match(a: str, b: str) -> bool:
    """Fuzzy Hebrew/Latin name comparison — True if names are close enough."""
    if a == b:
        return True
    parts_a = set(a.split())
    parts_b = set(b.split())
    common  = parts_a & parts_b
    smaller = min(len(parts_a), len(parts_b))
    return smaller > 0 and len(common) >= max(1, smaller // 2)


def _accepted_feedback(doc_type: str, data: dict) -> str:
    """Build a short confirmation message with key extracted fields."""
    label      = _DOC_LABELS.get(doc_type, doc_type)
    expiry     = data.get("expiry_date")
    holder     = data.get("holder_name") or data.get("owner_name")
    confidence = data.get("confidence", 0)

    lines = [f"✅ *{label} — התקבל!*"]
    if holder:
        lines.append(f"👤 שם: {holder}")
    if expiry:
        lines.append(f"📅 תפוגה: {expiry}")
    lines.append(f"🤖 ציון AI: {confidence}%")

    if doc_type == "vehicle_insurance":
        covers = data.get("covers_paid_transport")
        if covers is True:
            lines.append("✅ כולל כיסוי הסעת נוסעים בשכר ✓")
        elif covers is False:
            lines.append("⚠️ ביטוח *לא* כולל הסעת נוסעים — ייתכן בעיה באישור הסופי!")

    if doc_type == "vehicle_registration":
        plate = data.get("vehicle_plate")
        if plate:
            lines.append(f"🚗 מספר רכב: {plate}")

    lines.append("\nמעבר למסמך הבא ⬇️")
    return "\n".join(lines)


async def _force_advance(
    db: AsyncSession,
    phone: str,
    state: dict,
    failed_doc: str,
) -> None:
    """After max retries on a document, mark it failed and advance to the next."""
    from services import whatsapp as wa

    state["retry_count"] = 0
    pending = state["pending_docs"]

    if pending:
        state["current_doc"]  = pending[0]
        state["pending_docs"] = pending[1:]
        state["awaiting_image"] = True
        await redis_client.set(_state_key(phone), json.dumps(state, ensure_ascii=False), ex=_KYC_STATE_TTL)

        label = _DOC_LABELS.get(failed_doc, failed_doc)
        await wa.send_text(
            phone,
            f"⚠️ *{label} — הועבר לבדיקה ידנית*\n\n"
            "הצוות שלנו יבדוק אותו.\n"
            "ממשיכים למסמך הבא:",
        )
        await wa.send_text(phone, _DOC_MESSAGES[state["current_doc"]])
    else:
        state["awaiting_image"] = False
        await redis_client.set(_state_key(phone), json.dumps(state, ensure_ascii=False), ex=3600)
        await wa.send_text(
            phone,
            "⚠️ חלק מהמסמכים הועברו לבדיקה ידנית.\n"
            "🤖 מנתח את כל המסמכים שהתקבלו...",
        )
        asyncio.create_task(_finalize_review_task(phone, state))


async def _finalize_review_task(phone: str, state: dict) -> None:
    """Wrapper: creates its own DB session for the background Agent 2 review."""
    from core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        await _finalize_review(db, phone, state)


async def _finalize_review(db: AsyncSession, phone: str, state: dict) -> None:
    """
    Run Agent 2 cross-validation review and finalise the KYC application.
    Compares all collected docs against Israeli law AND Sumsub verified identity.
    """
    from services import whatsapp as wa

    app_id    = uuid.UUID(state["application_id"])
    driver_id = uuid.UUID(state["driver_id"])

    # ── Build Agent 2 payload ──────────────────────────────────────────────
    documents: dict = {
        doc_type: entry["data"]
        for doc_type, entry in state["collected_docs"].items()
        if not entry.get("failed") and entry.get("data")
    }
    sumsub_verified = {
        "verified_name":  state.get("sumsub_name") or "",
        "id_number":      state.get("sumsub_id") or "",
        "license_class":  state.get("sumsub_license_class") or "",
        "dob":            state.get("sumsub_dob") or "",
        "source": "sumsub.com — verified driving_license + selfie",
    }

    log.info(
        "[wa_kyc] Agent 2 review app=%s docs=%s",
        app_id, list(documents.keys()),
    )

    review_result = await _reviewer.run({
        "driver_type":     state["driver_type"],
        "documents":       documents,
        "application_id":  str(app_id),
        "sumsub_verified": sumsub_verified,
    })

    verdict  = review_result.data.get("verdict", "manual_review")
    blocking = review_result.data.get("blocking_issues", [])
    score    = review_result.data.get("compliance_score", 0)

    # ── Update KYCApplication ──────────────────────────────────────────────
    app = await db.get(KYCApplication, app_id)
    if app:
        app.agent2_result  = json.dumps(review_result.data, ensure_ascii=False)
        app.agent2_verdict = verdict
        app.agent2_model   = review_result.model_used
        app.compliance_score = score
        app.completed_at   = datetime.utcnow()

        if verdict == "approve" and not blocking:
            app.status       = KYCApplicationStatus.approved
            app.final_verdict = "approve"
        elif verdict == "reject" or blocking:
            app.status       = KYCApplicationStatus.rejected
            app.final_verdict = "reject"
            app.rejection_reasons = json.dumps(
                [b.get("issue", str(b)) for b in blocking],
                ensure_ascii=False,
            )
        else:
            app.status       = KYCApplicationStatus.needs_review
            app.final_verdict = "manual_review"

        # Populate verified summary from Agent 2
        summary = review_result.data.get("extracted_summary", {})
        if summary:
            app.verified_name  = summary.get("full_name")  or state.get("sumsub_name")
            app.id_number      = summary.get("id_number")  or state.get("sumsub_id")
            app.date_of_birth  = summary.get("dob")
            app.license_class  = summary.get("license_class") or state.get("sumsub_license_class")
            app.license_expiry = summary.get("license_expiry")

        app.insurance_covers_rideshare = bool(
            review_result.data.get("insurance_covers_rideshare", False)
        )
        await db.commit()
        log.info("[wa_kyc] finalized app=%s verdict=%s score=%s", app_id, verdict, score)

    # ── Update User.auth_status ────────────────────────────────────────────
    user = await db.get(User, driver_id)
    if user:
        if verdict == "approve" and not blocking:
            user.auth_status = AuthStatus.persona_completed   # awaiting manual → approved
        elif verdict == "reject":
            user.auth_status = AuthStatus.blocked             # can re-apply later
        # manual_review: stay in docs_collecting until admin decides
        await db.commit()
        log.info("[wa_kyc] user=%s auth_status=%s", driver_id, user.auth_status)

    # ── WhatsApp result notification ───────────────────────────────────────
    await _notify_result(phone, verdict, blocking, score)

    # Clean up Redis state on final decision
    if verdict in ("approve", "reject"):
        await redis_client.delete(_state_key(phone))


async def _notify_result(
    phone: str,
    verdict: str,
    blocking: list,
    score: int,
) -> None:
    from services import whatsapp as wa

    if verdict == "approve":
        msg = (
            "🎉 *בדיקת המסמכים הושלמה בהצלחה!*\n\n"
            f"ציון ציות: *{score}/100* ✅\n\n"
            "כל המסמכים שלך נסרקו ואושרו על ידי הבוט ו-AI.\n"
            "הפרופיל שלך עובר אישור סופי — תקבל/י הודעה תוך 24 שעות.\n\n"
            "📱 _עדכון יישלח לך בווטסאפ ברגע האישור._\n\n"
            "🚕 _ברוך הבא לצוות EasyTaxi Israel!_"
        )
    elif verdict == "reject":
        reasons = (
            "\n".join(f"• {b.get('issue', b)}" for b in blocking)
            if blocking else "• בעיה במסמכים"
        )
        msg = (
            "❌ *הבקשה נדחתה*\n\n"
            f"ציון ציות: {score}/100\n\n"
            f"*בעיות שזוהו:*\n{reasons}\n\n"
            "תוכל/י להגיש מחדש לאחר תיקון הבעיות.\n"
            "💬 לסיוע — שלח/י הודעה כאן ונעזור לך."
        )
    else:
        msg = (
            "⏳ *הבקשה הועברה לבדיקה ידנית*\n\n"
            f"ציון ציות: {score}/100\n\n"
            "הצוות שלנו יבדוק את המסמכים ויחזור אליך בקרוב (עד 24 שעות).\n"
            "💬 שאלות? שלח/י הודעה כאן."
        )
    try:
        await wa.send_text(phone, msg)
    except Exception as exc:
        log.warning("[wa_kyc] notify_result send failed: %s", exc)

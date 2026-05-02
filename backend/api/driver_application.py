"""
Passenger → Rideshare Driver conversion API

POST /passenger/become-driver           — submit application
GET  /passenger/become-driver/status    — check application status

Admin:
GET    /admin/driver-applications        — list all applications
PATCH  /admin/driver-applications/{id}/approve  — approve → role = driver
PATCH  /admin/driver-applications/{id}/reject   — reject with reason

Israeli rideshare law (חוק שירות שיתוף נסיעות, תשפ"ד):
  Currently in legislative process. Drivers may pre-register and prepare.
  Requirements (when law takes effect):
    - Age 21+, driving license B class (2+ years)
    - Vehicle insurance covering paid passenger transport
    - Police clearance (not older than 3 years)
    - Valid vehicle registration
    - NO professional taxi license required
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.driver_application import DriverApplication, DriverApplicationStatus
from models.user import AuthStatus, DriverType, User, UserRole

log = logging.getLogger(__name__)

router = APIRouter(tags=["driver-application"])


# ── Auth helpers ────────────────────────────────────────────────────────────

def _require_admin_key(x_admin_key: str | None = None):
    from fastapi import Header
    from core.config import settings
    if x_admin_key not in {settings.ADMIN_USERNAME, settings.EVOLUTION_API_KEY}:
        raise HTTPException(status_code=403, detail="Admin required")


async def _get_admin(current_user: User = Depends(get_current_user)) -> User:
    from core.dependencies import require_roles
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return current_user


# ── Request / response schemas ──────────────────────────────────────────────

class BecomeDriverRequest(BaseModel):
    has_vehicle:    bool         = Field(False, description="האם יש לך רכב כבר?")
    vehicle_number: str | None   = Field(None,  description="מספר רכב (לוחית)")
    vehicle_make:   str | None   = Field(None,  description="יצרן הרכב")
    vehicle_model:  str | None   = Field(None,  description="דגם הרכב")
    vehicle_year:   int | None   = Field(None,  ge=2010, le=2027, description="שנת ייצור")
    years_driving:  int | None   = Field(None,  ge=0, le=50, description="שנות ניסיון בנהיגה")
    motivation:     str | None   = Field(None,  max_length=500, description="מדוע אתה רוצה לנהוג?")


STATUS_LABEL = {
    "submitted":      "📬 הבקשה התקבלה",
    "sumsub_pending": "🪪 אימות זהות בתהליך",
    "docs_required":  "📋 נדרש העלאת מסמכים",
    "ai_review":      "🤖 נבדק ע\"י AI",
    "pending_admin":  "⏳ ממתין לאישור ידני",
    "approved":       "✅ אושרת — ברוך הבא לצוות!",
    "rejected":       "❌ הבקשה נדחתה",
}

NEXT_STEP = {
    "submitted":      "תקבל/י הודעת WhatsApp עם קישור לאימות זהות תוך זמן קצר.",
    "sumsub_pending": "השלם/י את אימות הזהות (רישיון + סלפי) דרך הקישור שנשלח.",
    "docs_required":  "שלח/י צילומי מסמכים דרך WhatsApp כפי שהתבקשת.",
    "ai_review":      "הבוט AI סורק את מסמכיך — ניידע אותך בסיום.",
    "pending_admin":  "הצוות שלנו בוחן את הבקשה — נחזור אליך תוך 24 שעות.",
    "approved":       "תוכל/י להתחיל לקבל נסיעות ברגע שהחוק ייכנס לתוקף!",
    "rejected":       "ניתן לפנות לתמיכה או לשלוח בקשה חדשה לאחר 30 יום.",
}


def _app_to_dict(app: DriverApplication, user: User | None = None) -> dict:
    return {
        "id":              str(app.id),
        "user_id":         str(app.user_id),
        "driver_type":     app.driver_type,
        "status":          app.status.value,
        "status_label":    STATUS_LABEL.get(app.status.value, app.status.value),
        "next_step":       NEXT_STEP.get(app.status.value, ""),
        "has_vehicle":     app.has_vehicle,
        "vehicle_number":  app.vehicle_number,
        "vehicle_make":    app.vehicle_make,
        "vehicle_model":   app.vehicle_model,
        "vehicle_year":    app.vehicle_year,
        "years_driving":   app.years_driving,
        "motivation":      app.motivation,
        "rejection_reason": app.rejection_reason,
        "admin_notes":     app.admin_notes,
        "created_at":      app.created_at.isoformat(),
        # Include some user info for admin
        **({"phone": user.phone, "full_name": user.full_name} if user else {}),
    }


# ── Passenger routes ────────────────────────────────────────────────────────

@router.post("/passenger/become-driver", status_code=status.HTTP_201_CREATED)
async def become_driver(
    body: BecomeDriverRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles(UserRole.passenger)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Passenger submits application to become a rideshare driver."""

    # Return existing application if already submitted (any non-rejected status)
    existing = await db.execute(
        select(DriverApplication).where(
            DriverApplication.user_id == current_user.id,
            DriverApplication.status != DriverApplicationStatus.rejected,
        ).order_by(DriverApplication.created_at.desc()).limit(1)
    )
    app = existing.scalar_one_or_none()
    if app:
        return {
            "application": _app_to_dict(app),
            "message": "בקשה קיימת — הצגת המצב הנוכחי",
        }

    # Create new application
    app = DriverApplication(
        user_id=current_user.id,
        driver_type="rideshare",
        has_vehicle=body.has_vehicle,
        vehicle_number=body.vehicle_number,
        vehicle_make=body.vehicle_make,
        vehicle_model=body.vehicle_model,
        vehicle_year=body.vehicle_year,
        years_driving=body.years_driving,
        motivation=body.motivation,
        status=DriverApplicationStatus.submitted,
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    log.info("[driver-app] new application id=%s user=%s", app.id, current_user.id)

    # Send WhatsApp welcome + Sumsub KYC link
    background_tasks.add_task(_notify_submitted, current_user.phone, str(app.id))

    return {
        "application": _app_to_dict(app),
        "message": "✅ הבקשה התקבלה! שלחנו לך הודעת WhatsApp עם הוראות להמשך.",
    }


@router.get("/passenger/become-driver/status", status_code=status.HTTP_200_OK)
async def become_driver_status(
    current_user: User = Depends(require_roles(UserRole.passenger)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Passenger checks current application status."""
    result = await db.execute(
        select(DriverApplication).where(
            DriverApplication.user_id == current_user.id,
        ).order_by(DriverApplication.created_at.desc()).limit(1)
    )
    app = result.scalar_one_or_none()
    if not app:
        return {"has_application": False, "application": None}

    return {"has_application": True, "application": _app_to_dict(app)}


# ── Admin routes ────────────────────────────────────────────────────────────

@router.get("/admin/driver-applications", status_code=status.HTTP_200_OK)
async def admin_list_applications(
    filter_status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    admin: User = Depends(_get_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: list all driver conversion applications."""
    from security.encryption import decrypt_field

    query = select(DriverApplication).order_by(DriverApplication.created_at.desc())
    if filter_status:
        try:
            query = query.where(
                DriverApplication.status == DriverApplicationStatus(filter_status)
            )
        except ValueError:
            raise HTTPException(422, detail=f"Invalid status: {filter_status}")
    query = query.limit(min(limit, 500)).offset(offset)
    result = await db.execute(query)
    apps = result.scalars().all()

    # Fetch user info for each
    user_ids = [a.user_id for a in apps]
    users_q = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in users_q.scalars().all()}

    def _safe_phone(u: User | None) -> str:
        if not u:
            return ""
        try:
            return decrypt_field(u.phone)
        except Exception:
            return ""

    items = []
    for a in apps:
        u = users_map.get(a.user_id)
        items.append({
            **_app_to_dict(a),
            "phone":      _safe_phone(u),
            "full_name":  u.full_name if u else None,
            "user_role":  u.role.value if u else None,
            "auth_status": u.auth_status.value if u else None,
        })

    return {"total": len(items), "items": items}


class AdminReviewRequest(BaseModel):
    notes: str | None = None


class AdminRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3)
    notes: str | None = None


@router.patch("/admin/driver-applications/{app_id}/approve", status_code=status.HTTP_200_OK)
async def admin_approve_application(
    app_id: uuid.UUID,
    body: AdminReviewRequest = AdminReviewRequest(),
    admin: User = Depends(_get_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Admin: approve a driver application.
    - Changes user.role to driver
    - Sets user.driver_type = rideshare
    - Sets user.auth_status = approved (active — can receive rides when law allows)
    - Sends WhatsApp notification
    """
    app = await db.get(DriverApplication, app_id)
    if not app:
        raise HTTPException(404, detail="Application not found")
    if app.status == DriverApplicationStatus.approved:
        raise HTTPException(409, detail="Already approved")

    user = await db.get(User, app.user_id)
    if not user:
        raise HTTPException(404, detail="User not found")

    # Promote to driver
    user.role        = UserRole.driver
    user.driver_type = DriverType.rideshare
    user.auth_status = AuthStatus.approved
    user.is_active   = True

    # Update application
    app.status      = DriverApplicationStatus.approved
    app.admin_notes = body.notes
    app.reviewed_by = admin.id
    app.reviewed_at = datetime.utcnow()

    # Copy vehicle info to user record
    if app.vehicle_number:
        user.vehicle_number = app.vehicle_number

    await db.commit()
    log.info("[driver-app] APPROVED id=%s user=%s by=%s", app_id, user.id, admin.id)

    # WhatsApp notification
    from services import whatsapp as wa
    try:
        from security.encryption import decrypt_field
        phone = decrypt_field(user.phone)
        await wa.send_text(
            phone,
            "🎉 *ברוך הבא לצוות EasyTaxi!*\n\n"
            "✅ בקשתך לנהוג כנהג שיתופי *אושרה בהצלחה!*\n\n"
            "━━━━━━━━━━━━━━\n"
            "🚗 *פרטי חשבונך:*\n"
            "• תפקיד: נהג שיתופי (רייד-שייר)\n"
            "• חוק הובר — נהיגה שיתופית\n"
            "• הסטטוס שלך: פעיל ✅\n\n"
            "⚖️ *לגבי החוק:*\n"
            "חוק שירות שיתוף נסיעות בישראל נמצא בתהליך חקיקה.\n"
            "ברגע שהחוק יאושר — תוכל/י להתחיל לקבל נסיעות!\n\n"
            "📱 *דשבורד נהג:*\n"
            "🔗 https://driver.easytaxiisrael.com\n\n"
            "💬 שאלות? שלח/י הודעה כאן — אנחנו זמינים! 🚕",
        )
    except Exception as exc:
        log.warning("[driver-app] approve WA notification failed: %s", exc)

    return {"status": "approved", "application": _app_to_dict(app)}


@router.patch("/admin/driver-applications/{app_id}/reject", status_code=status.HTTP_200_OK)
async def admin_reject_application(
    app_id: uuid.UUID,
    body: AdminRejectRequest,
    admin: User = Depends(_get_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: reject a driver application."""
    app = await db.get(DriverApplication, app_id)
    if not app:
        raise HTTPException(404, detail="Application not found")

    user = await db.get(User, app.user_id)

    app.status           = DriverApplicationStatus.rejected
    app.rejection_reason = body.reason
    app.admin_notes      = body.notes
    app.reviewed_by      = admin.id
    app.reviewed_at      = datetime.utcnow()
    await db.commit()
    log.info("[driver-app] REJECTED id=%s user=%s by=%s reason=%s", app_id, user and user.id, admin.id, body.reason)

    # WhatsApp notification
    if user:
        from services import whatsapp as wa
        try:
            from security.encryption import decrypt_field
            phone = decrypt_field(user.phone)
            await wa.send_text(
                phone,
                "❌ *בקשת הצטרפות כנהג שיתופי — נדחתה*\n\n"
                f"*סיבה:* {body.reason}\n\n"
                "ניתן לפנות לתמיכה לקבלת הסבר נוסף:\n"
                "💬 שלח/י הודעה כאן — נשמח לעזור.",
            )
        except Exception as exc:
            log.warning("[driver-app] reject WA notification failed: %s", exc)

    return {"status": "rejected", "application": _app_to_dict(app)}


@router.patch("/admin/driver-applications/{app_id}/status", status_code=status.HTTP_200_OK)
async def admin_update_status(
    app_id: uuid.UUID,
    body: dict,
    admin: User = Depends(_get_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: manually update application status (e.g. pending_admin → docs_required)."""
    app = await db.get(DriverApplication, app_id)
    if not app:
        raise HTTPException(404, detail="Application not found")
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(422, detail="status required")
    try:
        app.status = DriverApplicationStatus(new_status)
    except ValueError:
        raise HTTPException(422, detail=f"Invalid status: {new_status}")
    app.admin_notes = body.get("notes") or app.admin_notes
    await db.commit()
    return {"status": app.status.value, "application": _app_to_dict(app)}


# ── Background helpers ──────────────────────────────────────────────────────

async def _notify_submitted(phone: str, app_id: str) -> None:
    """Send welcome + next-steps WhatsApp message after submission."""
    from services import whatsapp as wa
    try:
        await wa.send_text(
            phone,
            "🚗 *ברוך הבא — EasyTaxi Driver Program!*\n\n"
            "✅ בקשתך לנהוג כנהג שיתופי התקבלה!\n\n"
            "━━━━━━━━━━━━━━\n"
            "📋 *שלבי האימות:*\n"
            "1️⃣ ✅ הגשת בקשה — הושלם\n"
            "2️⃣ 🔄 אימות זהות: רישיון + סלפי (Sumsub)\n"
            "3️⃣ ⏳ העלאת מסמכי רכב דרך WhatsApp\n"
            "4️⃣ 🤖 בדיקת AI + אישור צוות\n"
            "5️⃣ 🚗 נהיגה — ברגע שהחוק ייכנס לתוקף!\n\n"
            "━━━━━━━━━━━━━━\n"
            "📎 *לאימות זהות (רישיון + סלפי):*\n"
            "🔗 https://easytaxiisrael.com/become-driver/verify\n\n"
            "⚖️ *על חוק הובר:*\n"
            "חוק שירות שיתוף נסיעות בישראל נמצא בתהליך חקיקה סופי.\n"
            "הצטרף עכשיו וסיים את האימות — נהיגה תתחיל עם כניסת החוק!\n\n"
            "💬 _שאלות? שלח/י הודעה כאן ישירות_ 🙏",
        )
    except Exception as exc:
        log.warning("[driver-app] submit notification failed: %s", exc)

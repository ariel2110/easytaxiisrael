"""
WhatsApp admin API — exposes Evolution API key + instance info to the setup page.
Also handles incoming messages via Evolution API webhook, including WA auth flow.
"""

import logging

from fastapi import APIRouter, Depends, Request

from core.config import settings
from core.dependencies import get_current_user
from core.database import get_db
from models.user import User, UserRole
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current_user


@router.get("/config", summary="Return Evolution API key for the setup page")
async def get_whatsapp_config(_: User = Depends(_require_admin)) -> dict:
    return {
        "evolution_url": "/evolution",
        "instance": settings.EVOLUTION_INSTANCE,
        "api_key": settings.EVOLUTION_API_KEY,
    }


async def _handle_auth_message(phone: str, text: str, db: AsyncSession) -> bool:
    """
    Detect and process WhatsApp auth messages.
    Message format: "🔐 EasyTaxi: אמת אותי | <token>"
    Returns True if message was an auth message (processed or invalid).
    """
    from core.security import (
        WA_AUTH_MESSAGE_PREFIX,
        complete_wa_auth_session,
        get_wa_session_phone_role,
        normalize_phone,
    )
    from services import whatsapp as whatsapp_svc

    if WA_AUTH_MESSAGE_PREFIX not in text:
        return False

    # Extract token — format: "🔐 EasyTaxi: אמת אותי | <token>"
    try:
        token = text.split("|")[-1].strip()
    except Exception:
        return True  # was an auth message but malformed

    result = await get_wa_session_phone_role(token)
    if result is None:
        await whatsapp_svc.send_text(
            phone,
            "❌ *EasyTaxi* — קישור האימות פג תוקף.\n"
            "אנא חזור לאפליקציה ובקש קישור חדש.",
        )
        return True

    stored_phone, role = result
    sender_phone = normalize_phone(phone)

    # Verify the sender is the same phone that requested auth
    if sender_phone != stored_phone:
        await whatsapp_svc.send_text(
            phone,
            "❌ *EasyTaxi* — מספר הטלפון אינו תואם לבקשת האימות.",
        )
        return True

    # Find or create user
    res = await db.execute(select(User).where(User.phone == stored_phone))
    user = res.scalar_one_or_none()
    if user is None:
        user = User(phone=stored_phone, role=UserRole(role))
        db.add(user)
        await db.flush()

    if not user.is_active:
        await whatsapp_svc.send_text(
            phone,
            "❌ *EasyTaxi* — החשבון שלך מושעה. אנא פנה לתמיכה.",
        )
        return True

    # Complete auth session → stores JWT in Redis
    success = await complete_wa_auth_session(token, str(user.id), user.role.value)
    await db.commit()

    if success:
        dashboard_url = (
            "https://driver.easytaxiisrael.com"
            if user.role == UserRole.driver
            else "https://easytaxiisrael.com"
        )
        await whatsapp_svc.send_text(
            phone,
            f"✅ *EasyTaxi* — אומתת בהצלחה!\n\n"
            f"חזור לאפליקציה — הכניסה תושלם אוטומטית.\n"
            f"🔗 {dashboard_url}",
        )
    return True


@router.post("/webhook", summary="Receive incoming WhatsApp events from Evolution API")
async def whatsapp_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """
    Evolution API calls this endpoint for every WhatsApp event.
    Handles:
      - WA auth messages: "🔐 EasyTaxi: אמת אותי | <token>"
      - Connection updates (logged)
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ok"}

    event = payload.get("event", "")
    data = payload.get("data", {})

    if event == "messages.upsert":
        key = data.get("key", {})
        # Skip messages sent by us
        if key.get("fromMe"):
            return {"status": "ok"}

        remote_jid = key.get("remoteJid", "")
        phone = remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
        msg_obj = data.get("message", {})
        text = (
            msg_obj.get("conversation")
            or msg_obj.get("extendedTextMessage", {}).get("text")
            or ""
        )
        logger.info("📨 WhatsApp incoming | from=%s | text=%s", phone, text[:120])

        # Try to handle as auth message first
        if text:
            await _handle_auth_message(phone, text, db)

    elif event == "connection.update":
        state = data.get("state", "")
        logger.info("🔗 WhatsApp connection update: %s", state)

    return {"status": "ok"}


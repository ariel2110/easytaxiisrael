"""
WhatsApp admin API — exposes Evolution API key + instance info to the setup page.
Restricted to admin users only.
"""

import logging

from fastapi import APIRouter, Depends, Request

from core.config import settings
from core.dependencies import get_current_user
from models.user import User, UserRole
from fastapi import HTTPException, status

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


@router.post("/webhook", summary="Receive incoming WhatsApp events from Evolution API")
async def whatsapp_webhook(request: Request) -> dict:
    """
    Evolution API calls this endpoint for every WhatsApp event.
    Currently logs incoming messages; extend here to add auto-reply logic.
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

    elif event == "connection.update":
        state = data.get("state", "")
        logger.info("🔗 WhatsApp connection update: %s", state)

    return {"status": "ok"}

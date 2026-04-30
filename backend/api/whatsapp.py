"""
WhatsApp admin API — exposes Evolution API key + instance info to the setup page.
Also handles incoming messages via Evolution API webhook, including WA auth flow.
"""

import logging

from fastapi import APIRouter, Depends, Header, Request

from core.config import settings
from core.dependencies import get_current_user
from core.database import get_db
from models.user import User, UserRole, AuthStatus
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current_user


def _check_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    """Light auth for setup endpoints: requires the Evolution API key in X-Admin-Key header."""
    if not x_admin_key or x_admin_key != settings.EVOLUTION_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin key — pass X-Admin-Key header",
        )


@router.get("/config", summary="Return Evolution API key for the setup page")
async def get_whatsapp_config(_: User = Depends(_require_admin)) -> dict:
    return {
        "evolution_url": "/evolution",
        "instance": settings.EVOLUTION_INSTANCE,
        "api_key": settings.EVOLUTION_API_KEY,
    }


# ── Admin setup endpoints (protected by X-Admin-Key = EVOLUTION_API_KEY) ──────

@router.get("/status", summary="Get WhatsApp connection status and connected phone")
async def get_whatsapp_status(_: None = Depends(_check_admin_key)) -> dict:
    from services import whatsapp as wa
    from core.redis import redis_client
    info = await wa.get_instance_info()
    state = await wa.get_connection_state()
    owner_raw = (info or {}).get("owner", "")
    owner_phone = owner_raw.replace("@s.whatsapp.net", "") if owner_raw else None
    # Fetch webhook config from dedicated endpoint
    configured_webhook = await wa.get_webhook_url()
    # Effective platform phone: Redis override takes priority over settings
    redis_override = await redis_client.get("whatsapp:platform_phone")
    effective_platform_phone = redis_override if redis_override else settings.WHATSAPP_PLATFORM_PHONE
    return {
        "state": state,
        "owner_phone": owner_phone,
        "profile_name": (info or {}).get("profileName"),
        "configured_webhook": configured_webhook,
        "correct_webhook": "http://backend:8000/whatsapp/webhook",
        "platform_phone": effective_platform_phone,
        "platform_phone_source": "redis" if redis_override else "settings",
        "instance": settings.EVOLUTION_INSTANCE,
    }


@router.get("/qr", summary="Get QR code for WhatsApp connection")
async def get_whatsapp_qr(_: None = Depends(_check_admin_key)) -> dict:
    from services import whatsapp as wa
    data = await wa.get_qrcode()
    if data is None:
        raise HTTPException(status_code=503, detail="לא ניתן לקבל QR — בדוק שהאינסטנס קיים")
    return data


@router.post("/reconnect", summary="Logout current session and generate fresh QR code")
async def reconnect_whatsapp(_: None = Depends(_check_admin_key)) -> dict:
    import asyncio
    from services import whatsapp as wa
    await wa.logout_instance()
    await asyncio.sleep(2)  # Give Evolution API time to process the logout
    data = await wa.get_qrcode()
    return {"status": "ok", "qr": data}


@router.post("/fix-webhook", summary="Update Evolution API webhook URL to the correct backend endpoint")
async def fix_whatsapp_webhook(_: None = Depends(_check_admin_key)) -> dict:
    from services import whatsapp as wa
    correct_url = "http://backend:8000/whatsapp/webhook"
    ok = await wa.set_webhook(correct_url)
    return {"status": "ok" if ok else "error", "webhook_url": correct_url}


@router.post("/update-phone", summary="Update the platform WhatsApp phone number (stored in Redis, live update)")
async def update_platform_phone(body: dict, _: None = Depends(_check_admin_key)) -> dict:
    """
    Store the platform's WhatsApp phone number in Redis so the auth flow
    uses the correct number without requiring a backend restart.
    The value persists until overwritten.
    """
    from core.redis import redis_client
    phone = str(body.get("phone", "")).strip().lstrip("+").replace("-", "").replace(" ", "")
    if not phone or not phone.isdigit() or len(phone) < 7:
        raise HTTPException(status_code=400, detail="phone must be digits only, with country code (e.g. 972501234567)")
    await redis_client.set("whatsapp:platform_phone", phone)
    return {"status": "ok", "platform_phone": phone}


@router.get("/platform-phone", summary="Get the effective platform WhatsApp phone (Redis override or settings default)")
async def get_platform_phone(_: None = Depends(_check_admin_key)) -> dict:
    from core.redis import redis_client
    override = await redis_client.get("whatsapp:platform_phone")
    effective = override if override else settings.WHATSAPP_PLATFORM_PHONE
    return {
        "effective": effective,
        "redis_override": override if override else None,
        "settings_default": settings.WHATSAPP_PLATFORM_PHONE,
    }


@router.post("/test-send", summary="Send a test WhatsApp message to verify the connection")
async def test_send_whatsapp(body: dict, _: None = Depends(_check_admin_key)) -> dict:
    from services import whatsapp as wa
    phone = str(body.get("phone", "")).strip()
    if not phone:
        raise HTTPException(status_code=400, detail="phone is required")
    success = await wa.send_text(phone, "✅ *EasyTaxi* — הודעת בדיקה. המערכת עובדת! 🚕")
    return {"success": success}



async def _handle_auth_message(phone: str, text: str, db: AsyncSession, msg_id: str | None = None) -> bool:
    """
    Detect and process WhatsApp auth messages.
    Message format: "🔐 EasyTaxi: אמת אותי | <token>"
    Returns True if message was an auth message (processed or invalid).
    """
    from core.security import (
        WA_AUTH_MESSAGE_PREFIX,
        complete_wa_auth_session,
        get_wa_session_phone_role,
    )
    from services import whatsapp as whatsapp_svc

    if WA_AUTH_MESSAGE_PREFIX not in text and "EasyTaxi:" not in text:
        return False

    # Not an auth message if it doesn't contain the pipe separator with a token
    if "|" not in text:
        return False

    # Extract token — format: "🔐 EasyTaxi: אמת אותי | <token>"
    try:
        token = text.split("|")[-1].strip()
    except Exception:
        print(f"[AUTH-DEBUG] malformed auth message: {repr(text[:100])}", flush=True)
        return True  # was an auth message but malformed

    print(f"[AUTH-DEBUG] token={repr(token)} phone={repr(phone)}", flush=True)
    result = await get_wa_session_phone_role(token)
    print(f"[AUTH-DEBUG] get_wa_session_phone_role result={result}", flush=True)
    if result is None:
        await whatsapp_svc.send_text(
            phone,
            "⏰ *קישור האימות פג תוקף*\n\n"
            "הקישורים תקפים ל-10 דקות בלבד.\n"
            "לחץ כאן כדי לבקש קישור חדש:\n"
            "🔗 https://easytaxiisrael.com/login\n\n"
            "לעזרה: https://wa.me/447474775344",
        )
        return True

    stored_phone, role = result
    # Note: we do NOT validate sender phone vs stored_phone here.
    # For @lid (WA linked device) JIDs Evolution API may report the platform's own
    # number as sender instead of the real user phone. The token itself is the
    # security proof — it is a one-time unguessable hex value with a 5-minute TTL.

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

    # Deduplicate: skip if we already processed this exact WA message
    if msg_id and user.last_wa_msg_id == msg_id:
        return True

    # Complete auth session → stores JWT in Redis
    print(f"[AUTH-DEBUG] calling complete_wa_auth_session token={repr(token)} user_id={user.id}", flush=True)
    success = await complete_wa_auth_session(token, str(user.id), user.role.value)
    print(f"[AUTH-DEBUG] complete_wa_auth_session success={success}", flush=True)

    if success:
        # Update deduplication key
        if msg_id:
            user.last_wa_msg_id = msg_id

        if user.role == UserRole.driver:
            # Driver: create Persona inquiry immediately and send KYC link via WhatsApp
            from services import persona as persona_svc
            from core.config import settings as _settings
            kyc_url: str | None = None
            if _settings.PERSONA_API_KEY and _settings.PERSONA_TEMPLATE_ID:
                try:
                    inquiry = await persona_svc.create_inquiry(db, user.id)
                    # Include session-token for seamless hosted flow (no re-auth on Persona side)
                    if inquiry.session_token:
                        kyc_url = (
                            f"https://withpersona.com/verify"
                            f"?inquiry-id={inquiry.persona_inquiry_id}"
                            f"&session-token={inquiry.session_token}"
                        )
                    else:
                        kyc_url = f"https://withpersona.com/verify?inquiry-id={inquiry.persona_inquiry_id}"
                    user.auth_status = AuthStatus.persona_in_progress
                except Exception:
                    user.auth_status = AuthStatus.whatsapp_verified
            else:
                user.auth_status = AuthStatus.whatsapp_verified
            await db.commit()

            if kyc_url:
                await whatsapp_svc.send_text(
                    phone,
                    f"✅ *אומת בהצלחה!*\n\n"
                    f"שלב אחרון לפני שמתחילים לנסוע — אימות זהות מהיר (כ-2 דקות).\n"
                    f"תצטרך: תעודת זהות או דרכון + צילום פנים (סלפי).\n\n"
                    f"🔗 {kyc_url}\n\n"
                    f"לאחר האישור תוכל לחזור לדשבורד הנהג:\n"
                    f"🚗 https://driver.easytaxiisrael.com\n\n"
                    f"_לתמיכה: https://wa.me/447474775344_",
                )
            else:
                await whatsapp_svc.send_text(
                    phone,
                    "✅ *אומת בהצלחה!*\n\n"
                    "כדי להשלים הרשמה ולהגדיר את הרכב שלך, היכנס לדשבורד הנהג:\n"
                    "🚗 https://driver.easytaxiisrael.com\n\n"
                    "_לתמיכה: https://wa.me/447474775344_",
                )
        else:
            # Passenger: immediately approved after WhatsApp
            user.auth_status = AuthStatus.approved
            await db.commit()
            await whatsapp_svc.send_text(
                phone,
                "✅ *האימות הצליח!*\n\n"
                "ברוך הבא ל-EasyTaxi ישראל 🚕\n\n"
                "חזור לדפדפן — הדף כבר מתעדכן אוטומטית ויכניס אותך.\n\n"
                "לא רואה? לחץ כאן:\n"
                "👉 https://easytaxiisrael.com/app\n\n"
                "_EasyTaxi Israel — מהיר, בטוח, ללא סיסמא_ 🚕",
            )
    else:
        await db.commit()
    return True


async def _handle_support_message(phone: str, text: str, reply_jid: str | None = None) -> None:
    """Route a regular incoming WhatsApp message through the SupportAgent and reply."""
    from services import whatsapp as whatsapp_svc
    from services.agents.support import SupportAgent

    print(f"[SUPPORT] called phone={phone} reply_jid={reply_jid} text={repr(text[:100])}", flush=True)
    agent = SupportAgent()
    try:
        result = await agent.run({"message": text, "user_role": "passenger", "context": {}, "history": []})
        print(f"[SUPPORT] agent result success={result.success} data={result.data}", flush=True)
        reply = (result.data or {}).get("response") if result.data else None
    except Exception as exc:
        logger.exception("SupportAgent error: %s", exc)
        print(f"[SUPPORT] exception: {exc}", flush=True)
        reply = None

    if not reply:
        is_heb = any("\u05d0" <= c <= "\u05ea" for c in text)
        reply = (
            "תודה על פנייתך 🙏 נציג שירות יחזור אליך בהקדם."
            if is_heb
            else "Thank you for contacting us. A support agent will follow up shortly."
        )

    if reply_jid:
        await whatsapp_svc.send_text_to_jid(reply_jid, reply)
    else:
        await whatsapp_svc.send_text(phone, reply)



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
    print(f"[WH-RAW] event={repr(event)} data_keys={list(data.keys()) if isinstance(data, dict) else type(data).__name__}", flush=True)
    print(f"[WH-FULL] payload_keys={list(payload.keys())} sender={repr(payload.get('sender'))} instance={repr(payload.get('instance'))}", flush=True)

    # Evolution API v1.8+ uses UPPERCASE event names; normalise for compatibility
    event_lower = event.lower().replace("_", ".")

    if event_lower in ("messages.upsert",):
        key = data.get("key", {})
        # Skip messages sent by us
        if key.get("fromMe"):
            return {"status": "ok"}

        remote_jid = key.get("remoteJid", "")
        push_name = data.get("pushName", "")

        if remote_jid.endswith("@lid"):
            from core.redis import redis_client
            # Try to resolve @lid → real phone via Redis cache
            cached_phone = await redis_client.get(f"lid_phone:{remote_jid}")
            if cached_phone:
                phone = cached_phone
                reply_jid = None  # can now use real phone
                print(f"[WH-LID] resolved {remote_jid} → {phone} (cache)", flush=True)
            else:
                # Fallback: scan contacts store for matching pushName
                import os, json as _json
                contacts_dir = f"/evolution/store/contacts/{settings.EVOLUTION_INSTANCE}"
                resolved = None
                try:
                    for fname in os.listdir(contacts_dir):
                        if not fname.endswith("@s.whatsapp.net.json"):
                            continue
                        with open(f"{contacts_dir}/{fname}") as f:
                            c = _json.load(f)
                        if push_name and c.get("pushName") == push_name:
                            resolved = fname.replace("@s.whatsapp.net.json", "")
                            break
                except Exception:
                    pass
                if resolved:
                    phone = resolved
                    reply_jid = None
                    await redis_client.set(f"lid_phone:{remote_jid}", phone, ex=86400 * 30)
                    print(f"[WH-LID] resolved {remote_jid} → {phone} (pushName match)", flush=True)
                else:
                    phone = remote_jid.replace("@lid", "")
                    reply_jid = remote_jid
                    print(f"[WH-LID] unresolved {remote_jid}, pushName={push_name}", flush=True)
        else:
            reply_jid = None
            phone = remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "")

        msg_id = key.get("id")
        msg_obj = data.get("message", {})
        text = (
            msg_obj.get("conversation")
            or msg_obj.get("extendedTextMessage", {}).get("text")
            or ""
        )
        print(f"[WH-DEBUG] from={phone} reply_jid={reply_jid} jid={remote_jid} text={repr(text[:200])}", flush=True)
        logger.info("📨 WhatsApp incoming | from=%s | text=%s", phone, text[:120])

        # Try to handle as auth message first; if not auth, pass to support bot
        if text:
            is_auth = await _handle_auth_message(phone, text, db, msg_id)
            if not is_auth:
                await _handle_support_message(phone, text, reply_jid=reply_jid)

    elif event_lower in ("connection.update",):
        state = data.get("state", "")
        logger.info("🔗 WhatsApp connection update: %s", state)

    return {"status": "ok"}


"""
WhatsApp admin API — exposes Evolution API key + instance info to the setup page.
Also handles incoming messages via Evolution API webhook, including WA auth flow.
"""

import logging

from fastapi import APIRouter, Depends, Header, Query, Request, Response

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
    valid_keys = {settings.EVOLUTION_API_KEY}
    if not x_admin_key or x_admin_key not in valid_keys:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin key — pass X-Admin-Key header",
        )


@router.get("/config", summary="Return WhatsApp provider config for the setup page")
async def get_whatsapp_config(_: User = Depends(_require_admin)) -> dict:
    from services.whatsapp import _meta_enabled
    if _meta_enabled():
        return {
            "provider": "meta",
            "phone_number_id": settings.WHATSAPP_PHONE_NUMBER_ID,
            "waba_id": settings.WHATSAPP_WABA_ID,
            "api_version": settings.WHATSAPP_API_VERSION,
            "webhook_url": "https://easytaxiisrael.com/api/whatsapp/webhook",
        }
    return {
        "provider": "evolution",
        "evolution_url": "/evolution",
        "instance": settings.EVOLUTION_INSTANCE,
        "api_key": settings.EVOLUTION_API_KEY,
    }


# ── Admin setup endpoints (protected by X-Admin-Key = EVOLUTION_API_KEY) ──────

@router.get("/status", summary="Get WhatsApp connection status and connected phone")
async def get_whatsapp_status(_: None = Depends(_check_admin_key)) -> dict:
    from services import whatsapp as wa
    from services.whatsapp import _meta_enabled
    from core.redis import redis_client
    info = await wa.get_instance_info()
    state = await wa.get_connection_state()
    provider = "meta" if _meta_enabled() else "evolution"
    owner_raw = (info or {}).get("owner", "")
    owner_phone = owner_raw.replace("@s.whatsapp.net", "") if owner_raw else None
    configured_webhook = await wa.get_webhook_url()
    redis_override = await redis_client.get("whatsapp:platform_phone")
    effective_platform_phone = redis_override if redis_override else settings.WHATSAPP_PLATFORM_PHONE
    return {
        "provider": provider,
        "state": state,
        "owner_phone": owner_phone,
        "profile_name": (info or {}).get("profileName"),
        "quality_rating": (info or {}).get("quality_rating"),
        "configured_webhook": configured_webhook,
        "correct_webhook": "https://easytaxiisrael.com/api/whatsapp/webhook",
        "platform_phone": effective_platform_phone,
        "platform_phone_source": "redis" if redis_override else "settings",
        "instance": settings.EVOLUTION_INSTANCE if provider == "evolution" else None,
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

    # Extract token — supports both formats:
    #   new: "🔐 EasyTaxi: אמת אותי | [abc12345] (מ.פ.ז)"
    #   legacy: "🔐 EasyTaxi: אמת אותי | abc12345"
    try:
        raw_token = text.split("|")[-1].strip()
        if raw_token.startswith("[") and "]" in raw_token:
            token = raw_token[1:raw_token.index("]")]
        else:
            token = raw_token  # legacy format — backward compatible
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
            "הקישורים תקפים ל-15 דקות בלבד.\n"
            "לחץ כאן כדי לבקש קישור חדש:\n"
            "🔗 https://easytaxiisrael.com/login\n\n"
            "💬 _שאלות? תמיד ניתן לשלוח הודעה כאן — אנחנו זמינים!_",
        )
        return True

    stored_phone, role = result

    # ── Phone number verification ────────────────────────────────────────────
    # Compare the sender's number with the one stored in the session.
    # @lid JIDs (Evolution API linked-device) cannot be resolved here — skip check.
    # The token itself is a cryptographic single-use secret, so this is a defence-
    # in-depth measure, not the primary security control.
    from core.security import normalize_phone as _norm_phone
    is_lid = phone.endswith("@lid") or not phone.replace("+", "").isdigit()
    if not is_lid and _norm_phone(phone) != stored_phone:
        print(
            f"[AUTH-SECURITY] phone mismatch: sender={_norm_phone(phone)} stored={stored_phone}",
            flush=True,
        )
        await whatsapp_svc.send_text(
            phone,
            "⚠️ *שגיאת אימות — מספר לא תואם*\n\n"
            "ההודעה נשלחה ממספר שונה מזה שהוזן בטופס ההרשמה.\n\n"
            "אנא ודא שאתה שולח מהמספר שהזנת ונסה שוב:\n"
            "🔗 https://easytaxiisrael.com/login\n\n"
            "💬 _יש בעיה? שלח הודעה כאן ונעזור לך._",
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
            # Driver: WhatsApp verified — send Sumsub KYC link (license + selfie only)
            user.auth_status = AuthStatus.whatsapp_verified
            await db.commit()

            # Build Sumsub KYC URL for the driver dashboard
            kyc_url = f"https://driver.easytaxiisrael.com/verify"

            await whatsapp_svc.send_text(
                phone,
                f"👋 *נהג יקר, תודה על הרשמתך ל-EasyTaxi!*\n\n"
                f"✅ אימות הוואטסאפ הושלם בהצלחה.\n"
                f"נא להיכנס לקישור להמשך תהליך ההרשמה ואימות הזהות:\n\n"
                f"🔗 {kyc_url}\n\n"
                f"━━━━━━━━━━━━━━\n"
                f"📋 *שלבי ההצטרפות:*\n"
                f"1️⃣ ✅ אימות וואטסאפ — הושלם\n"
                f"2️⃣ 🔄 אימות זהות: רישיון נהיגה + סלפי — כ-2 דקות\n"
                f"3️⃣ ⏳ בדיקת מסמכים ע\"י המערכת\n"
                f"4️⃣ 🚗 התחלת קבלת נסיעות!\n"
                f"━━━━━━━━━━━━━━\n\n"
                f"📎 *קישורים חשובים:*\n"
                f"🚗 דשבורד נהג: https://driver.easytaxiisrael.com\n"
                f"❓ שאלות נפוצות: https://easytaxiisrael.com/faq\n\n"
                f"💬 _שאלות? פרטים? ניתן לשלוח הודעה כאן ישירות — נשמח לעזור!_\n"
                f"_EasyTaxi Israel — מצרפים אותך לצוות_ 🚕",
            )
        else:
            # Passenger: immediately approved after WhatsApp
            user.auth_status = AuthStatus.approved
            await db.commit()
            await whatsapp_svc.send_text(
                phone,
                "🎉 *ברוך הבא ל-EasyTaxi ישראל!*\n\n"
                "✅ האימות הצליח בהצלחה — הדף כבר מתעדכן אוטומטית.\n"
                "ניתן לחזור לדפדפן כעת 👆\n\n"
                "━━━━━━━━━━━━━━\n"
                "📱 *קישורים שימושיים:*\n"
                "🚕 הזמן נסיעה: https://easytaxiisrael.com/app\n"
                "❓ שאלות נפוצות: https://easytaxiisrael.com/faq\n"
                "👤 החשבון שלי: https://easytaxiisrael.com/app\n"
                "━━━━━━━━━━━━━━\n\n"
                "💬 *יש שאלה? תמיד ניתן לשלוח הודעה כאן — אנחנו זמינים!* 😊\n"
                "_EasyTaxi Israel — מהיר, בטוח, ללא סיסמא_ 🚕",
            )
    else:
        await db.commit()
    return True


async def _handle_support_message(phone: str, text: str, reply_jid: str | None = None) -> None:
    """Route a regular incoming WhatsApp message through the SupportAgent and reply."""
    import json as _json
    from core.redis import redis_client
    from services import whatsapp as whatsapp_svc
    from services.agents.support import SupportAgent

    print(f"[SUPPORT] called phone={phone} reply_jid={reply_jid} text={repr(text[:100])}", flush=True)

    # Load conversation history from Redis (last 10 turns, TTL 30 min)
    history_key = f"wa_chat_history:{phone}"
    raw_history = await redis_client.get(history_key)
    history: list[dict] = _json.loads(raw_history) if raw_history else []

    agent = SupportAgent()
    try:
        result = await agent.run({"message": text, "user_role": "passenger", "context": {}, "history": history})
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

    # Save turn to history (keep last 10 turns = 20 messages)
    history.append({"role": "user", "content": text})
    history.append({"role": "assistant", "content": reply})
    if len(history) > 20:
        history = history[-20:]
    await redis_client.set(history_key, _json.dumps(history, ensure_ascii=False), ex=1800)

    if reply_jid:
        await whatsapp_svc.send_text_to_jid(reply_jid, reply)
    else:
        await whatsapp_svc.send_text(phone, reply)


async def _handle_kyc_image_meta(phone: str, msg: dict, db: AsyncSession) -> bool:
    """
    Handle an image/document sent via Meta Cloud API.
    Returns True if the image was consumed by the KYC doc-collection flow.
    """
    from services import wa_kyc_flow

    # Quick state check before downloading (saves a network call if not in collection)
    if not await wa_kyc_flow.is_in_collection(phone):
        return False

    # Resolve media object — Meta puts the id in msg["image"]["id"] or msg["document"]["id"]
    media_obj = (
        msg.get("image")
        or msg.get("document")
        or msg.get("video")
        or {}
    )
    media_id  = media_obj.get("id")
    mime_type = media_obj.get("mime_type", "image/jpeg")

    if not media_id:
        return False

    from services.whatsapp import download_meta_media, send_text
    image_bytes = await download_meta_media(media_id)
    if not image_bytes:
        await send_text(phone, "⚠️ לא הצלחנו לפתוח את התמונה. נסה/י לשלוח שוב.")
        return True  # was in KYC flow, consumed

    return await wa_kyc_flow.handle_wa_image(db, phone, image_bytes, mime_type)


async def _handle_kyc_image_evolution(
    phone: str,
    img_data: dict,
    msg_obj: dict,
    db: AsyncSession,
) -> bool:
    """
    Handle an image/document sent via Evolution API.
    Evolution often includes base64-encoded media directly in the webhook payload.
    Returns True if the image was consumed by the KYC flow.
    """
    from services import wa_kyc_flow

    if not await wa_kyc_flow.is_in_collection(phone):
        return False

    import base64 as _b64

    # Evolution may provide base64 directly or a download URL
    b64_data = msg_obj.get("base64") or img_data.get("base64")
    if b64_data:
        # Strip data-URI prefix if present (data:image/jpeg;base64,...)
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        try:
            image_bytes = _b64.b64decode(b64_data)
        except Exception:
            image_bytes = None
    else:
        image_bytes = None

    if not image_bytes:
        logger.warning("[wa_kyc] evolution image: no base64 available for phone=%s", phone)
        return False

    mime_type = img_data.get("mimetype", "image/jpeg")
    return await wa_kyc_flow.handle_wa_image(db, phone, image_bytes, mime_type)


# ── Meta Cloud API webhook verification ─────────────────────────────────────

@router.get(
    "/webhook",
    summary="Meta Cloud API webhook verification challenge",
    include_in_schema=False,
)
async def meta_webhook_verify(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> Response:
    """
    Meta calls GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
    We must return the challenge value as plain text to verify the endpoint.
    """
    if (
        hub_mode == "subscribe"
        and hub_verify_token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN
        and hub_challenge
    ):
        logger.info("Meta webhook verified successfully")
        return Response(content=hub_challenge, media_type="text/plain")
    logger.warning(
        "Meta webhook verification failed: mode=%s token_match=%s",
        hub_mode,
        hub_verify_token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    )
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/webhook", summary="Receive incoming WhatsApp events (Meta Cloud API or Evolution API)")
async def whatsapp_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """
    Handles incoming events from both providers.

    Meta Cloud API payload structure:
      {"object":"whatsapp_business_account","entry":[{"changes":[{"value":{...}}]}]}

    Evolution API payload structure:
      {"event":"MESSAGES_UPSERT","data":{...}}
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ok"}

    # ── Detect provider by payload shape ──────────────────────────────────────
    if payload.get("object") == "whatsapp_business_account":
        return await _handle_meta_webhook(payload, db)

    # Evolution API path (legacy)
    return await _handle_evolution_webhook(payload, db)


async def _handle_meta_webhook(payload: dict, db: AsyncSession) -> dict:
    """
    Process a Meta Cloud API webhook event.
    Spec: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
    """
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            if change.get("field") != "messages":
                continue

            # Process each message
            for msg in value.get("messages", []):
                msg_id = msg.get("id")
                from_phone = msg.get("from", "")  # digits only, no +

                msg_type = msg.get("type", "")
                if msg_type == "text":
                    text = msg.get("text", {}).get("body", "")
                elif msg_type == "interactive":
                    # Button reply or list reply
                    text = (
                        msg.get("interactive", {}).get("button_reply", {}).get("id", "")
                        or msg.get("interactive", {}).get("list_reply", {}).get("id", "")
                    )
                elif msg_type in ("image", "document", "video"):
                    # KYC document upload via WhatsApp
                    handled = await _handle_kyc_image_meta(from_phone, msg, db)
                    if handled:
                        continue  # image was consumed by KYC flow
                    text = ""
                else:
                    text = ""

                if not text:
                    continue

                logger.info("📨 Meta WhatsApp | from=%s | text=%s", from_phone, text[:120])
                print(f"[META-WH] from={from_phone} type={msg_type} text={repr(text[:200])}", flush=True)

                is_auth = await _handle_auth_message(from_phone, text, db, msg_id)
                if not is_auth:
                    await _handle_support_message(from_phone, text, reply_jid=None)

            # Process status updates (delivery receipts etc.) — just log
            for status_item in value.get("statuses", []):
                status_val = status_item.get("status")
                msg_id_ref = status_item.get("id")
                logger.debug("Meta message status: %s for msg=%s", status_val, msg_id_ref)

    return {"status": "ok"}


async def _handle_evolution_webhook(payload: dict, db: AsyncSession) -> dict:
    """Process an Evolution API webhook event (legacy path)."""
    event = payload.get("event", "")
    data = payload.get("data", {})
    print(f"[EVO-WH] event={repr(event)} data_keys={list(data.keys()) if isinstance(data, dict) else type(data).__name__}", flush=True)

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

        # Try to handle as auth message first; if not auth, try KYC image, then support bot
        if text:
            is_auth = await _handle_auth_message(phone, text, db, msg_id)
            if not is_auth:
                await _handle_support_message(phone, text, reply_jid=reply_jid)
        else:
            # No text — check for image (Evolution API imageMessage)
            img_data = msg_obj.get("imageMessage") or msg_obj.get("documentMessage")
            if img_data:
                await _handle_kyc_image_evolution(phone, img_data, msg_obj, db)

    elif event_lower in ("connection.update",):
        state = data.get("state", "")
        logger.info("🔗 WhatsApp connection update: %s", state)

    return {"status": "ok"}


"""
WhatsApp service — rideos-platform.

Routing logic:
  • If WHATSAPP_PHONE_NUMBER_ID is configured → Meta WhatsApp Cloud API (official)
  • Otherwise → Evolution API (legacy fallback)

The public interface is identical in both cases:
    from services.whatsapp import send_text
    await send_text("+972501234567", "ההודעה שלך")

All public helpers are fire-and-forget safe — they catch every exception
and log a warning rather than crashing the caller.

Meta Cloud API docs:
  https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
"""

import logging

import httpx

from core.config import settings
from core.security import normalize_phone

logger = logging.getLogger(__name__)

# ── Provider selection ────────────────────────────────────────────────────────

def _meta_enabled() -> bool:
    """True when Meta Cloud API credentials are configured."""
    return bool(settings.WHATSAPP_PHONE_NUMBER_ID and settings.WHATSAPP_ACCESS_TOKEN)


# ── Shared phone normalisation ────────────────────────────────────────────────

def _normalize(phone: str) -> str:
    """Return digits-only phone with country code (no +), e.g. '972501234567'."""
    return normalize_phone(phone)


# ══════════════════════════════════════════════════════════════════════════════
# Meta WhatsApp Cloud API
# ══════════════════════════════════════════════════════════════════════════════

def _meta_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }


def _meta_url() -> str:
    ver = settings.WHATSAPP_API_VERSION
    pid = settings.WHATSAPP_PHONE_NUMBER_ID
    return f"https://graph.facebook.com/{ver}/{pid}/messages"


async def _meta_post(payload: dict) -> dict | None:
    """POST to Meta Graph API. Returns response JSON on success, None on failure."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(_meta_url(), json=payload, headers=_meta_headers())
            if r.status_code in (200, 201):
                return r.json()
            logger.warning("Meta WhatsApp API → %s %s", r.status_code, r.text[:300])
    except Exception as exc:
        logger.warning("Meta WhatsApp send failed: %s", exc)
    return None


async def _meta_send_text(phone: str, text: str) -> bool:
    number = _normalize(phone)
    result = await _meta_post({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": number,
        "type": "text",
        "text": {"preview_url": False, "body": text},
    })
    logger.debug("Meta send_text to=%s result=%s", number, result)
    return result is not None


async def _meta_send_template(phone: str, template_name: str, components: list | None = None) -> bool:
    """Send a pre-approved Meta message template."""
    number = _normalize(phone)
    result = await _meta_post({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "he"},
            "components": components or [],
        },
    })
    logger.debug("Meta send_template %s to=%s result=%s", template_name, number, result)
    return result is not None


def _meta_body_params(*values: str) -> list:
    """Build the 'body' component with positional parameters for a Meta template."""
    return [{
        "type": "body",
        "parameters": [{"type": "text", "text": v} for v in values],
    }]


# ══════════════════════════════════════════════════════════════════════════════
# Evolution API (legacy fallback)
# ══════════════════════════════════════════════════════════════════════════════

_EVO_BASE = settings.EVOLUTION_URL.rstrip("/")
_EVO_HDRS = {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}
_EVO_INST = settings.EVOLUTION_INSTANCE


async def _evo_post(path: str, payload: dict) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(f"{_EVO_BASE}/{path}", json=payload, headers=_EVO_HDRS)
            if r.status_code in (200, 201):
                return r.json()
            logger.warning("Evolution API %s → %s %s", path, r.status_code, r.text[:200])
    except Exception as exc:
        logger.warning("Evolution WhatsApp send failed: %s", exc)
    return None


async def _evo_send_text(phone: str, text: str) -> bool:
    number = _normalize(phone)
    result = await _evo_post(
        f"message/sendText/{_EVO_INST}",
        {"number": number, "textMessage": {"text": text}},
    )
    return result is not None


async def _evo_send_text_to_jid(jid: str, text: str) -> bool:
    result = await _evo_post(
        f"message/sendText/{_EVO_INST}",
        {"number": jid, "textMessage": {"text": text}},
    )
    return result is not None


# ══════════════════════════════════════════════════════════════════════════════
# Public API — provider-agnostic
# ══════════════════════════════════════════════════════════════════════════════

async def send_text(phone: str, text: str) -> bool:
    """Send a plain-text WhatsApp message. Returns True on success."""
    if _meta_enabled():
        return await _meta_send_text(phone, text)
    return await _evo_send_text(phone, text)


async def send_text_to_jid(jid: str, text: str) -> bool:
    """Send to a raw JID — only meaningful for Evolution API (@lid resolution).
    With Meta Cloud API the JID suffix is stripped and treated as a phone number."""
    if _meta_enabled():
        phone = jid.replace("@s.whatsapp.net", "").replace("@lid", "").replace("@g.us", "")
        return await _meta_send_text(phone, text)
    return await _evo_send_text_to_jid(jid, text)


# ── High-level helpers ────────────────────────────────────────

async def send_otp(phone: str, otp: str) -> bool:
    if _meta_enabled():
        return await _meta_send_template(
            phone,
            "easytaxi_otp",
            _meta_body_params(otp),
        )
    msg = (
        f"🚕 *EasyTaxi Israel*\n\n"
        f"קוד האימות שלך: *[{otp}]*\n"
        f"_(מ.פ.ז — מספר פנימי זמני, תקף ל-5 דקות)_\n\n"
        f"אל תשתף קוד זה עם אף אחד."
    )
    return await send_text(phone, msg)


async def notify_ride_assigned(passenger_phone: str, driver_phone: str | None, ride_id: str) -> None:
    short = str(ride_id)[:8]
    if _meta_enabled():
        await _meta_send_template(
            passenger_phone,
            "easytaxi_ride_assigned",
            _meta_body_params(short),
        )
        return
    await send_text(passenger_phone,
        f"🚕 *EasyTaxi* — נמצא לך נהג!\n"
        f"נסיעה #{short} — הנהג בדרך אליך.\n"
        f"עקוב בזמן אמת: https://easytaxiisrael.com/passenger.html")


async def notify_ride_started(passenger_phone: str, ride_id: str) -> None:
    short = str(ride_id)[:8]
    if _meta_enabled():
        await _meta_send_template(
            passenger_phone,
            "easytaxi_ride_started",
            _meta_body_params(short),
        )
        return
    await send_text(passenger_phone,
        f"🟢 *EasyTaxi* — הנסיעה התחילה!\n"
        f"נסיעה #{short} — נסיעה טובה! 🚀")


async def notify_ride_completed(passenger_phone: str, fare_ils: float, ride_id: str) -> None:
    short = str(ride_id)[:8]
    if _meta_enabled():
        await _meta_send_template(
            passenger_phone,
            "easytaxi_ride_completed",
            _meta_body_params(short, f"{fare_ils:.2f}"),
        )
        return
    await send_text(passenger_phone,
        f"✅ *EasyTaxi* — הנסיעה הסתיימה\n"
        f"נסיעה #{short}\n"
        f"💳 סכום: ₪{fare_ils:.2f}\n"
        f"תודה שנסעת איתנו! ⭐")


async def notify_ride_cancelled(phone: str, ride_id: str, by: str = "system") -> None:
    short = str(ride_id)[:8]
    if _meta_enabled():
        await _meta_send_template(
            phone,
            "easytaxi_ride_cancelled",
            _meta_body_params(short),
        )
        return
    who = "הנסיעה בוטלה" if by == "system" else f"הנסיעה בוטלה על ידי {'הנוסע' if by == 'passenger' else 'הנהג'}"
    await send_text(phone, f"❌ *EasyTaxi* — {who}\nנסיעה #{short}")


async def notify_driver_new_ride(driver_phone: str, ride_id: str, pickup: str) -> None:
    short = str(ride_id)[:8]
    if _meta_enabled():
        await _meta_send_template(
            driver_phone,
            "easytaxi_driver_new_ride",
            _meta_body_params(short, pickup),
        )
        return
    await send_text(driver_phone,
        f"🔔 *EasyTaxi* — נסיעה חדשה!\n"
        f"נסיעה #{short}\n"
        f"📍 מוצא: {pickup}\n"
        f"היכנס לאפליקציה לקבל: https://driver.easytaxiisrael.com")


# ══════════════════════════════════════════════════════════════════════════════
# Meta Cloud API — phone number info
# ══════════════════════════════════════════════════════════════════════════════

async def meta_get_phone_info() -> dict | None:
    """Return Meta phone number registration info (display_phone_number, verified_name, quality)."""
    if not _meta_enabled():
        return None
    try:
        ver = settings.WHATSAPP_API_VERSION
        pid = settings.WHATSAPP_PHONE_NUMBER_ID
        url = f"https://graph.facebook.com/{ver}/{pid}"
        params = {"fields": "display_phone_number,verified_name,quality_rating,status"}
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, params=params, headers=_meta_headers())
            return r.json() if r.status_code == 200 else None
    except Exception as exc:
        logger.warning("meta_get_phone_info failed: %s", exc)
        return None


# ══════════════════════════════════════════════════════════════════════════════
# Evolution API — instance management helpers (used by setup page)
# These are no-ops when Meta Cloud API is active.
# ══════════════════════════════════════════════════════════════════════════════

async def create_instance() -> dict | None:
    if _meta_enabled():
        return {"note": "Meta Cloud API active — Evolution instance not needed"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{_EVO_BASE}/instance/create",
                json={
                    "instanceName": _EVO_INST,
                    "qrcode": True,
                    "integration": "WHATSAPP-BAILEYS",
                },
                headers=_EVO_HDRS,
            )
            return r.json() if r.status_code in (200, 201) else None
    except Exception as exc:
        logger.warning("create_instance failed: %s", exc)
        return None


async def get_qrcode() -> dict | None:
    if _meta_enabled():
        return {"connected": True, "provider": "meta", "state": "open"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{_EVO_BASE}/instance/fetchInstances",
                headers=_EVO_HDRS,
            )
            if r.status_code != 200:
                return None
            instances = r.json()
            for inst in (instances if isinstance(instances, list) else [instances]):
                if inst.get("instance", {}).get("instanceName") == _EVO_INST:
                    state = inst.get("instance", {}).get("status") or inst.get("instance", {}).get("connectionStatus", "")
                    if state == "open":
                        return {"connected": True, "state": state}
                    qr = await client.get(
                        f"{_EVO_BASE}/instance/connect/{_EVO_INST}",
                        headers=_EVO_HDRS,
                    )
                    if qr.status_code == 200:
                        return {"connected": False, "state": state, **qr.json()}
        return None
    except Exception as exc:
        logger.warning("get_qrcode failed: %s", exc)
        return None


async def get_connection_state() -> str:
    if _meta_enabled():
        return "open"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{_EVO_BASE}/instance/connectionState/{_EVO_INST}",
                headers=_EVO_HDRS,
            )
            if r.status_code == 200:
                return r.json().get("instance", {}).get("state", "unknown")
    except Exception:
        pass
    return "unknown"


async def get_instance_info() -> dict | None:
    if _meta_enabled():
        info = await meta_get_phone_info()
        if info:
            return {
                "owner": info.get("display_phone_number", ""),
                "profileName": info.get("verified_name", ""),
                "status": "open",
                "provider": "meta",
                "quality_rating": info.get("quality_rating"),
            }
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{_EVO_BASE}/instance/fetchInstances", headers=_EVO_HDRS)
            if r.status_code != 200:
                return None
            instances = r.json()
            for item in (instances if isinstance(instances, list) else [instances]):
                if item.get("instance", {}).get("instanceName") == _EVO_INST:
                    return item.get("instance", {})
    except Exception as exc:
        logger.warning("get_instance_info failed: %s", exc)
    return None


async def logout_instance() -> bool:
    if _meta_enabled():
        return True  # Meta Cloud API has no concept of QR-based sessions
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.delete(
                f"{_EVO_BASE}/instance/logout/{_EVO_INST}",
                headers=_EVO_HDRS,
            )
            logger.info("logout_instance → %s %s", r.status_code, r.text[:200])
            return r.status_code in (200, 201, 400)
    except Exception as exc:
        logger.warning("logout_instance failed: %s", exc)
        return False


async def get_webhook_url() -> str | None:
    if _meta_enabled():
        # Meta webhook URL is configured in App Dashboard, not via API
        return "https://easytaxiisrael.com/api/whatsapp/webhook"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{_EVO_BASE}/webhook/find/{_EVO_INST}",
                headers=_EVO_HDRS,
            )
            if r.status_code == 200:
                return (r.json() or {}).get("url") or None
    except Exception as exc:
        logger.warning("get_webhook_url failed: %s", exc)
    return None


async def set_webhook(url: str) -> bool:
    if _meta_enabled():
        return True  # Meta webhook is set in the App Dashboard
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{_EVO_BASE}/webhook/set/{_EVO_INST}",
                json={
                    "url": url,
                    "webhook_by_events": False,
                    "webhook_base64": False,
                    "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
                },
                headers=_EVO_HDRS,
            )
            logger.info("set_webhook → %s %s", r.status_code, r.text[:200])
            return r.status_code in (200, 201)
    except Exception as exc:
        logger.warning("set_webhook failed: %s", exc)
        return False

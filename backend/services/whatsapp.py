"""
WhatsApp service via Evolution API.

Usage:
    from services.whatsapp import send_text
    await send_text("+972501234567", "ההודעה שלך")

All public helpers are fire-and-forget safe — they catch every exception
and log a warning rather than crashing the caller.
"""

import logging
import re

import httpx

from core.config import settings
from core.security import normalize_phone

logger = logging.getLogger(__name__)

_BASE = settings.EVOLUTION_URL.rstrip("/")
_KEY  = settings.EVOLUTION_API_KEY
_INST = settings.EVOLUTION_INSTANCE
_HDRS = {"apikey": _KEY, "Content-Type": "application/json"}


def _normalize(phone: str) -> str:
    """Normalize phone for Evolution API (digits only, 972… prefix)."""
    return normalize_phone(phone)


async def _post(path: str, payload: dict) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(f"{_BASE}/{path}", json=payload, headers=_HDRS)
            if r.status_code in (200, 201):
                return r.json()
            logger.warning("WhatsApp API %s → %s %s", path, r.status_code, r.text[:200])
    except Exception as exc:
        logger.warning("WhatsApp send failed: %s", exc)
    return None


async def send_text(phone: str, text: str) -> bool:
    """Send a plain-text WhatsApp message. Returns True on success."""
    number = _normalize(phone)
    print(f"[SEND_TEXT] to={number} text={repr(text[:80])}", flush=True)
    result = await _post(
        f"message/sendText/{_INST}",
        {"number": number, "textMessage": {"text": text}},
    )
    print(f"[SEND_TEXT] result={result}", flush=True)
    return result is not None


async def send_text_to_jid(jid: str, text: str) -> bool:
    """Send a plain-text WhatsApp message to a raw JID (e.g. @lid or @s.whatsapp.net).
    Use this when the phone number cannot be resolved (e.g. Meta @lid anonymous IDs)."""
    result = await _post(
        f"message/sendText/{_INST}",
        {"number": jid, "textMessage": {"text": text}},
    )
    return result is not None


# ── High-level helpers ────────────────────────────────────────

async def send_otp(phone: str, otp: str) -> bool:
    msg = (
        f"🚕 *EasyTaxi Israel*\n\n"
        f"קוד האימות שלך: *{otp}*\n\n"
        f"תקף ל-5 דקות. אל תשתף אותו עם אף אחד."
    )
    return await send_text(phone, msg)


async def notify_ride_assigned(passenger_phone: str, driver_phone: str | None, ride_id: str) -> None:
    short = str(ride_id)[:8]
    await send_text(passenger_phone,
        f"🚕 *EasyTaxi* — נמצא לך נהג!\n"
        f"נסיעה #{short} — הנהג בדרך אליך.\n"
        f"עקוב בזמן אמת: https://easytaxiisrael.com/passenger.html")


async def notify_ride_started(passenger_phone: str, ride_id: str) -> None:
    short = str(ride_id)[:8]
    await send_text(passenger_phone,
        f"🟢 *EasyTaxi* — הנסיעה התחילה!\n"
        f"נסיעה #{short} — נסיעה טובה! 🚀")


async def notify_ride_completed(passenger_phone: str, fare_ils: float, ride_id: str) -> None:
    short = str(ride_id)[:8]
    await send_text(passenger_phone,
        f"✅ *EasyTaxi* — הנסיעה הסתיימה\n"
        f"נסיעה #{short}\n"
        f"💳 סכום: ₪{fare_ils:.2f}\n"
        f"תודה שנסעת איתנו! ⭐")


async def notify_ride_cancelled(phone: str, ride_id: str, by: str = "system") -> None:
    short = str(ride_id)[:8]
    who = "הנסיעה בוטלה" if by == "system" else f"הנסיעה בוטלה על ידי {'הנוסע' if by == 'passenger' else 'הנהג'}"
    await send_text(phone,
        f"❌ *EasyTaxi* — {who}\nנסיעה #{short}")


async def notify_driver_new_ride(driver_phone: str, ride_id: str, pickup: str) -> None:
    short = str(ride_id)[:8]
    await send_text(driver_phone,
        f"🔔 *EasyTaxi* — נסיעה חדשה!\n"
        f"נסיעה #{short}\n"
        f"📍 מוצא: {pickup}\n"
        f"היכנס לאפליקציה לקבל: https://driver.easytaxiisrael.com")


# ── Instance management helpers (called from setup page) ─────

async def create_instance() -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{_BASE}/instance/create",
                json={
                    "instanceName": _INST,
                    "qrcode": True,
                    "integration": "WHATSAPP-BAILEYS",
                },
                headers=_HDRS,
            )
            return r.json() if r.status_code in (200, 201) else None
    except Exception as exc:
        logger.warning("create_instance failed: %s", exc)
        return None


async def get_qrcode() -> dict | None:
    """Returns {base64, code} or None if not ready."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{_BASE}/instance/fetchInstances",
                headers=_HDRS,
            )
            if r.status_code != 200:
                return None
            instances = r.json()
            for inst in (instances if isinstance(instances, list) else [instances]):
                if inst.get("instance", {}).get("instanceName") == _INST:
                    state = inst.get("instance", {}).get("status") or inst.get("instance", {}).get("connectionStatus", "")
                    if state == "open":
                        return {"connected": True, "state": state}
                    # fetch QR
                    qr = await client.get(
                        f"{_BASE}/instance/connect/{_INST}",
                        headers=_HDRS,
                    )
                    if qr.status_code == 200:
                        data = qr.json()
                        return {"connected": False, "state": state, **data}
        return None
    except Exception as exc:
        logger.warning("get_qrcode failed: %s", exc)
        return None


async def get_connection_state() -> str:
    """Returns: 'open' | 'connecting' | 'close' | 'unknown'"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{_BASE}/instance/connectionState/{_INST}",
                headers=_HDRS,
            )
            if r.status_code == 200:
                data = r.json()
                return data.get("instance", {}).get("state", "unknown")
    except Exception:
        pass
    return "unknown"


async def get_instance_info() -> dict | None:
    """Returns the instance info dict (owner, status, webhook, etc.) or None."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{_BASE}/instance/fetchInstances", headers=_HDRS)
            if r.status_code != 200:
                return None
            instances = r.json()
            for item in (instances if isinstance(instances, list) else [instances]):
                if item.get("instance", {}).get("instanceName") == _INST:
                    return item.get("instance", {})
    except Exception as exc:
        logger.warning("get_instance_info failed: %s", exc)
    return None


async def logout_instance() -> bool:
    """Logout current WhatsApp session (keeps instance config, disconnects session)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.delete(f"{_BASE}/instance/logout/{_INST}", headers=_HDRS)
            logger.info("logout_instance → %s %s", r.status_code, r.text[:200])
            return r.status_code in (200, 201, 400)  # 400 = already disconnected
    except Exception as exc:
        logger.warning("logout_instance failed: %s", exc)
        return False


async def get_webhook_url() -> str | None:
    """Fetch the currently configured webhook URL from Evolution API."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{_BASE}/webhook/find/{_INST}", headers=_HDRS)
            if r.status_code == 200:
                return (r.json() or {}).get("url") or None
    except Exception as exc:
        logger.warning("get_webhook_url failed: %s", exc)
    return None


async def set_webhook(url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{_BASE}/webhook/set/{_INST}",
                json={
                    "url": url,
                    "webhook_by_events": False,
                    "webhook_base64": False,
                    "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
                },
                headers=_HDRS,
            )
            logger.info("set_webhook → %s %s", r.status_code, r.text[:200])
            return r.status_code in (200, 201)
    except Exception as exc:
        logger.warning("set_webhook failed: %s", exc)
        return False

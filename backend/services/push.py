"""
Push notification service — rideos-platform.

Supports Firebase Cloud Messaging (FCM) when FIREBASE_SERVICE_ACCOUNT_PATH
is set in the environment.  Falls back to structured logging when no
credentials are configured, so the rest of the app is never affected.

Environment variables:
    FIREBASE_SERVICE_ACCOUNT_PATH  — absolute path to the Firebase service
                                     account JSON file.
                                     e.g. /app/firebase-service-account.json
"""

import logging
import os
from enum import Enum

logger = logging.getLogger(__name__)

# ── FCM initialisation (once, at import time) ────────────────────────────────
_fcm_app = None

def _init_fcm() -> bool:
    global _fcm_app
    if _fcm_app is not None:
        return True

    creds_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    if not creds_path or not os.path.isfile(creds_path):
        return False

    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate(creds_path)
        _fcm_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialised (%s)", creds_path)
        return True
    except Exception:
        logger.exception("Failed to initialise Firebase Admin SDK")
        return False


_fcm_ready = _init_fcm()


# ── Event catalogue ──────────────────────────────────────────────────────────

class PushEvent(str, Enum):
    ride_assigned      = "ride_assigned"
    ride_accepted      = "ride_accepted"
    ride_rejected      = "ride_rejected"
    ride_started       = "ride_started"
    ride_completed     = "ride_completed"
    ride_cancelled     = "ride_cancelled"
    driver_arriving    = "driver_arriving"
    payment_received   = "payment_received"
    otp_code           = "otp_code"


_TEMPLATES: dict[PushEvent, tuple[str, str]] = {
    PushEvent.ride_assigned:    ("נהג בדרך אליך",      "נהג שויך לנסיעה שלך. הוא בדרך!"),
    PushEvent.ride_accepted:    ("הנסיעה אושרה",        "הנהג מאשר — הוא בדרך אליך"),
    PushEvent.ride_rejected:    ("הנסיעה נדחתה",        "הנהג ביטל. מחפשים נהג אחר..."),
    PushEvent.ride_started:     ("הנסיעה החלה",         "בדרך ליעד!"),
    PushEvent.ride_completed:   ("הנסיעה הסתיימה",      "הגעת! אנא דרג את הנהג שלך."),
    PushEvent.ride_cancelled:   ("הנסיעה בוטלה",        "הנסיעה בוטלה."),
    PushEvent.driver_arriving:  ("הנהג מגיע",           "הנהג ממתין לך — אנא רד."),
    PushEvent.payment_received: ("תשלום התקבל",         "תשלום עבור הנסיעה התקבל בהצלחה."),
    PushEvent.otp_code:         ("קוד אימות",           "קוד הכניסה שלך: {otp}"),
}


async def _send_push(
    device_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    if _fcm_ready:
        try:
            from firebase_admin import messaging
            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
                token=device_token,
                android=messaging.AndroidConfig(priority="high"),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", badge=1),
                    ),
                ),
            )
            messaging.send(message)
            logger.debug("PUSH [fcm] token=%.12s... title=%r", device_token, title)
            return True
        except Exception:
            logger.exception("FCM send failed for token=%.12s...", device_token)
            return False
    else:
        logger.info(
            "PUSH [no-fcm] token=%.12s... title=%r body=%r data=%s",
            device_token, title, body, data,
        )
        return True


async def send_event(
    device_token: str | None,
    event: PushEvent,
    extra_data: dict | None = None,
    **template_vars: str,
) -> bool:
    """
    Send a push notification for a named event.

    Args:
        device_token:  FCM/APNs token. If None or empty, silently skipped.
        event:         Notification template key.
        extra_data:    Extra data payload key-value pairs.
        **template_vars: Substituted into body template (e.g. otp="123456").

    Returns True on success, False if skipped or failed.
    """
    if not device_token:
        return False

    title, body_tpl = _TEMPLATES.get(event, ("EasyTaxi", str(event.value)))
    try:
        body = body_tpl.format(**template_vars)
    except KeyError:
        body = body_tpl

    try:
        return await _send_push(device_token, title, body, extra_data)
    except Exception:
        logger.exception(
            "Push notification failed for event=%s token=%.12s...", event, device_token
        )
        return False

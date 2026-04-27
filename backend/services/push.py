"""
Push notification service — rideos-platform.

Current implementation: structured logging mock.
Replace `_send_push()` with real FCM / APNs calls when you have credentials.

To switch to real FCM:
    pip install firebase-admin
    and set FIREBASE_CREDENTIALS_JSON in env (path to service account JSON).
"""

import logging
from enum import Enum

logger = logging.getLogger(__name__)


class PushEvent(str, Enum):
    ride_assigned      = "ride_assigned"
    ride_accepted      = "ride_accepted"
    ride_rejected      = "ride_rejected"
    ride_started       = "ride_started"
    ride_completed     = "ride_completed"
    ride_cancelled     = "ride_cancelled"
    driver_arriving    = "driver_arriving"
    payment_received   = "payment_received"
    otp_code           = "otp_code"           # fallback if WhatsApp fails


# Templates: event → (title, body template)
_TEMPLATES: dict[PushEvent, tuple[str, str]] = {
    PushEvent.ride_assigned:   ("נהג בדרך אליך", "נהג שויך לנסיעה שלך. הוא בדרך!"),
    PushEvent.ride_accepted:   ("הנסיעה אושרה", "הנהג מאשר — הוא בדרך אליך"),
    PushEvent.ride_rejected:   ("הנסיעה נדחתה", "הנהג ביטל. מחפשים נהג אחר..."),
    PushEvent.ride_started:    ("הנסיעה החלה", "בדרך ליעד!"),
    PushEvent.ride_completed:  ("הנסיעה הסתיימה", "הגעת! אנא דרג את הנהג שלך."),
    PushEvent.ride_cancelled:  ("הנסיעה בוטלה", "הנסיעה בוטלה."),
    PushEvent.driver_arriving: ("הנהג מגיע", "הנהג ממתין לך — אנא רד."),
    PushEvent.payment_received: ("תשלום התקבל", "תשלום עבור הנסיעה התקבל בהצלחה."),
    PushEvent.otp_code:        ("קוד אימות", "קוד הכניסה שלך: {otp}"),
}


async def _send_push(
    device_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """
    Mock implementation — logs the push and returns True.

    Replace this function body with real FCM calls:

        from firebase_admin import messaging
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=device_token,
        )
        messaging.send(message)
    """
    logger.info(
        "PUSH [mock] token=%.12s... title=%r body=%r data=%s",
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
        device_token:  FCM/APNs token for the target device.
                       If None or empty, the call is silently skipped.
        event:         Which notification template to use.
        extra_data:    Key-value pairs sent as the notification data payload.
        **template_vars: Variables substituted into the body template (e.g. otp="123456").

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
        logger.exception("Push notification failed for event=%s token=%.12s...", event, device_token)
        return False

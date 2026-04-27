import json
import re
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt

from core.config import settings
from core.redis import redis_client

ALGORITHM = "HS256"
OTP_TTL_SECONDS = 300        # 5 minutes
REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600  # 7 days
WA_AUTH_TTL_SECONDS = 300    # 5 minutes for WhatsApp auth sessions


# ---------------------------------------------------------------------------
# Phone normalization — centralised, used by auth + WhatsApp service
# ---------------------------------------------------------------------------

def normalize_phone(phone: str) -> str:
    """
    Normalise any Israeli phone format to E.164 without the leading '+'.
    Accepted inputs:
      0546363350        → 972546363350
      972546363350      → 972546363350
      +972546363350     → 972546363350
      +972 54-636-3350  → 972546363350
    Returns digits-only string starting with country code (972…).
    """
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "972" + digits[1:]
    if not digits.startswith("972"):
        digits = "972" + digits
    return digits


# ---------------------------------------------------------------------------
# OTP helpers (kept for compatibility / fallback)
# ---------------------------------------------------------------------------

def _otp_redis_key(phone: str) -> str:
    return f"otp:{phone}"


def _refresh_redis_key(token: str) -> str:
    return f"refresh:{token}"


async def create_otp(phone: str) -> str:
    """Generate a 6-digit OTP, store it in Redis with a TTL, and return it."""
    otp = f"{secrets.randbelow(1_000_000):06d}"
    await redis_client.setex(_otp_redis_key(phone), OTP_TTL_SECONDS, otp)
    return otp


async def verify_otp(phone: str, otp: str) -> bool:
    """
    Validate OTP using a timing-safe comparison.
    Deletes the key on success (single-use).
    """
    stored = await redis_client.get(_otp_redis_key(phone))
    if stored and secrets.compare_digest(stored, otp):
        await redis_client.delete(_otp_redis_key(phone))
        return True
    return False


# ---------------------------------------------------------------------------
# WhatsApp auth sessions
# ---------------------------------------------------------------------------
# Flow:
#   1. Client calls POST /auth/wa/request  → gets (session_id, whatsapp_link)
#   2. System stores  wa_token:<token> = JSON{phone, role, session_id}  TTL 5m
#                     wa_session:<session_id> = "pending"               TTL 5m
#   3. User opens whatsapp link → sends the pre-filled message
#   4. Webhook receives message, extracts token, calls complete_wa_auth_session
#      → stores  wa_session:<session_id> = JSON{access, refresh, role}
#   5. Client polls GET /auth/wa/poll/<session_id>
#      → when status changes from "pending", returns JWT tokens

WA_AUTH_TOKEN_PREFIX   = "wa_token:"
WA_AUTH_SESSION_PREFIX = "wa_session:"
WA_AUTH_MESSAGE_PREFIX = "🔐 EasyTaxi:"   # message prefix for detection in webhook


def _wa_token_key(token: str) -> str:
    return f"{WA_AUTH_TOKEN_PREFIX}{token}"


def _wa_session_key(session_id: str) -> str:
    return f"{WA_AUTH_SESSION_PREFIX}{session_id}"


async def create_wa_auth_session(phone: str, role: str) -> tuple[str, str]:
    """
    Create a new WA auth session.
    Returns (session_id, one_time_token).
    """
    normalized = normalize_phone(phone)
    token = secrets.token_hex(8)          # 16-char hex, easy to embed in message
    session_id = secrets.token_urlsafe(24)

    token_data = json.dumps({"phone": normalized, "role": role, "session_id": session_id})
    await redis_client.setex(_wa_token_key(token), WA_AUTH_TTL_SECONDS, token_data)
    await redis_client.setex(_wa_session_key(session_id), WA_AUTH_TTL_SECONDS + 30, "pending")
    return session_id, token


async def complete_wa_auth_session(token: str, user_id: str, role: str) -> bool:
    """
    Called from the webhook after the user sends the auth message.
    Looks up the token → issues JWT → stores result in session key.
    Returns True if the token was valid and session was completed.
    """
    raw = await redis_client.get(_wa_token_key(token))
    if not raw:
        return False
    await redis_client.delete(_wa_token_key(token))   # single-use
    data = json.loads(raw)
    session_id = data["session_id"]

    access  = create_access_token(user_id, role)
    refresh = await create_refresh_token(user_id, role)
    result  = json.dumps({"access_token": access, "refresh_token": refresh, "role": role})
    # Store for polling — keep for 2 min after completion
    await redis_client.setex(_wa_session_key(session_id), 120, result)
    return True


async def get_wa_session_result(session_id: str) -> dict | None:
    """
    Poll result: returns None (still pending) or token dict (completed).
    Returns False-like when session expired.
    """
    raw = await redis_client.get(_wa_session_key(session_id))
    if raw is None or raw == "pending":
        return None
    return json.loads(raw)


async def wa_session_is_pending(session_id: str) -> bool:
    """Returns True if session exists but hasn't been completed yet."""
    raw = await redis_client.get(_wa_session_key(session_id))
    return raw == "pending"


async def get_wa_session_phone_role(token: str) -> tuple[str, str] | None:
    """Return (phone, role) stored for a given WA auth token, or None if expired."""
    raw = await redis_client.get(_wa_token_key(token))
    if not raw:
        return None
    data = json.loads(raw)
    return data["phone"], data["role"]


# ---------------------------------------------------------------------------
# JWT access token
# ---------------------------------------------------------------------------

def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": subject,
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify an access token. Raises jose.JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])


# ---------------------------------------------------------------------------
# Refresh token (opaque, stored in Redis)
# ---------------------------------------------------------------------------

async def create_refresh_token(subject: str, role: str) -> str:
    """Create a cryptographically random opaque refresh token stored in Redis."""
    token = secrets.token_urlsafe(48)
    payload = json.dumps({"sub": subject, "role": role})
    await redis_client.setex(_refresh_redis_key(token), REFRESH_TOKEN_TTL_SECONDS, payload)
    return token


async def rotate_refresh_token(old_token: str) -> tuple[str, str] | None:
    """
    Validate old refresh token, delete it atomically, and issue a new pair.
    Returns (access_token, refresh_token) or None if token is invalid/expired.
    """
    raw = await redis_client.get(_refresh_redis_key(old_token))
    if not raw:
        return None
    await redis_client.delete(_refresh_redis_key(old_token))
    payload = json.loads(raw)
    access = create_access_token(payload["sub"], payload["role"])
    refresh = await create_refresh_token(payload["sub"], payload["role"])
    return access, refresh


async def revoke_refresh_token(token: str) -> None:
    """Immediately invalidate a refresh token (logout)."""
    await redis_client.delete(_refresh_redis_key(token))

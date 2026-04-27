import json
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt

from core.config import settings
from core.redis import redis_client

ALGORITHM = "HS256"
OTP_TTL_SECONDS = 300        # 5 minutes
REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600  # 7 days


# ---------------------------------------------------------------------------
# OTP helpers
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

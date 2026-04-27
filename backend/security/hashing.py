"""
Password hashing with bcrypt via passlib.

Used for any future password-based auth flows (admin console, internal tools).
The primary OTP-based auth in api/auth.py does NOT use passwords,
but this module is wired in for completeness and future use.
"""

from passlib.context import CryptContext

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plaintext: str) -> str:
    """Return a bcrypt hash suitable for DB storage."""
    return _ctx.hash(plaintext)


def verify_password(plaintext: str, hashed: str) -> bool:
    """Timing-safe comparison of a plaintext password against its hash."""
    return _ctx.verify(plaintext, hashed)

"""
Encryption service using Fernet (symmetric authenticated encryption).

Keys are derived from settings.ENCRYPTION_KEY.
Never log or expose the raw key.
"""

import base64
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import String
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator

from core.config import settings


def _get_fernet() -> Fernet:
    # Ensure the key is 32 url-safe base64 bytes (Fernet requirement)
    raw = settings.ENCRYPTION_KEY.encode()
    padded = base64.urlsafe_b64encode(raw.ljust(32)[:32])
    return Fernet(padded)


def encrypt(plaintext: str) -> str:
    """Encrypt a UTF-8 string. Returns a URL-safe base64 token."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    """
    Decrypt a token produced by encrypt().
    Raises ValueError on tampered / invalid tokens.
    """
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Decryption failed: invalid or tampered token") from exc


def encrypt_field(value: str | None) -> str | None:
    """Convenience wrapper — handles None transparently."""
    return encrypt(value) if value is not None else None


def decrypt_field(token: str | None) -> str | None:
    return decrypt(token) if token is not None else None


# ---------------------------------------------------------------------------
# SQLAlchemy TypeDecorator — transparent at-rest encryption
# ---------------------------------------------------------------------------

class EncryptedString(TypeDecorator):
    """
    Store a string column encrypted at rest using Fernet.
    Transparent to Python code: reads/writes plain strings, stores ciphertext.
    Column must be wide enough for the ciphertext (~150 chars for a phone number).
    """

    impl = String(500)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> str | None:
        if value is None:
            return None
        return encrypt(str(value))

    def process_result_value(self, value: Any, dialect: Dialect) -> str | None:
        if value is None:
            return None
        return decrypt(value)

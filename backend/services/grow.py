"""
Grow payment gateway integration (grow.business).

Responsibilities:
  - Tokenize a card (client-side Grow.js sends the token; we store it)
  - Charge a stored token
  - Refund a transaction

Configuration (set in .env when ready):
  GROW_API_KEY     — from grow.business merchant dashboard
  GROW_API_SECRET  — from grow.business merchant dashboard
  GROW_SANDBOX     — True for testing, False for production

NOTE: Cards are NEVER stored raw. Only the Grow token is kept (encrypted at rest
      via EncryptedString). This satisfies PCI-DSS SAQ-A requirements.

When credentials are not configured, all functions raise a clear error instead
of silently succeeding with mock data — this prevents accidental "free" rides.
"""

import httpx
from decimal import Decimal
from fastapi import HTTPException, status
from core.config import settings


def _client() -> httpx.AsyncClient:
    base = settings.GROW_API_URL
    auth = (settings.GROW_API_KEY, settings.GROW_API_SECRET)
    return httpx.AsyncClient(base_url=base, auth=auth, timeout=15.0)


def _check_configured() -> None:
    if not settings.GROW_API_KEY or not settings.GROW_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="מערכת התשלומים טרם הוגדרה. אנא פנה לתמיכה.",
        )


async def charge_token(
    grow_token: str,
    amount_ils: Decimal,
    description: str,
    idempotency_key: str,
) -> dict:
    """
    Charge a stored Grow payment token.

    Returns the Grow transaction object on success.
    Raises HTTPException on failure / insufficient funds.

    Args:
        grow_token:      The token returned by Grow.js / stored in DB
        amount_ils:      Amount in Israeli Shekels (Decimal, 2 decimal places)
        description:     Human-readable charge description (shown on card statement)
        idempotency_key: Unique key per charge attempt (prevents double-charge)
    """
    _check_configured()
    payload = {
        "token": grow_token,
        "amount": int(amount_ils * 100),   # Grow expects agorot (cents)
        "currency": "ILS",
        "description": description,
        "idempotency_key": idempotency_key,
    }
    async with _client() as client:
        resp = await client.post("/charges", json=payload)

    if resp.status_code == 402:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="הכרטיס נדחה. אנא נסה כרטיס אחר.",
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"שגיאת תשלום: {resp.text[:200]}",
        )
    return resp.json()


async def refund_transaction(grow_transaction_id: str, amount_ils: Decimal | None = None) -> dict:
    """
    Refund a Grow transaction. Pass amount_ils for partial refund, or None for full.
    """
    _check_configured()
    payload: dict = {}
    if amount_ils is not None:
        payload["amount"] = int(amount_ils * 100)

    async with _client() as client:
        resp = await client.post(f"/charges/{grow_transaction_id}/refund", json=payload)

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"שגיאת החזר תשלום: {resp.text[:200]}",
        )
    return resp.json()

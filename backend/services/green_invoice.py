"""
Green Invoice / Morning integration (greeninvoice.co.il).

Responsibilities:
  - Issue a receipt (קבלה) after a completed ride
  - Issue a tax invoice (חשבונית מס) for business-profile rides (auto-emailed)
  - Authenticate with the Green Invoice API (JWT, refreshed per request)

Configuration (set in .env when ready):
  GREENINVOICE_API_ID        — from greeninvoice.co.il → Settings → API
  GREENINVOICE_API_SECRET    — from greeninvoice.co.il → Settings → API
  GREENINVOICE_BUSINESS_NAME — your company name on invoices
  GREENINVOICE_BUSINESS_TAX_ID — your ח.פ / ע.מ

Green Invoice API docs: https://www.greeninvoice.co.il/api-docs/
Document type codes:
  320  — חשבונית מס (Tax Invoice)
  400  — קבלה (Receipt)
  405  — חשבונית מס קבלה (Tax Invoice + Receipt combined)
"""

import httpx
from decimal import Decimal
from core.config import settings

_GI_BASE = "https://api.greeninvoice.co.il/api/v1"


async def _get_jwt() -> str:
    """Authenticate with Green Invoice API and return a short-lived JWT."""
    async with httpx.AsyncClient(base_url=_GI_BASE, timeout=10.0) as client:
        resp = await client.post(
            "/account/token",
            json={"id": settings.GREENINVOICE_API_ID, "secret": settings.GREENINVOICE_API_SECRET},
        )
        resp.raise_for_status()
        return resp.json()["token"]


def _is_configured() -> bool:
    return bool(settings.GREENINVOICE_API_ID and settings.GREENINVOICE_API_SECRET)


async def create_receipt(
    ride_id: str,
    passenger_name: str,
    passenger_email: str | None,
    amount_ils: Decimal,
    description: str = "",
) -> str | None:
    """
    Issue a receipt (קבלה — document type 400) for a completed ride.

    Returns the Green Invoice document URL (PDF), or None if not configured.
    The receipt is emailed to passenger_email if provided.
    """
    if not _is_configured():
        return None   # silently skip — not yet set up

    jwt = await _get_jwt()
    payload = {
        "description": description or f"נסיעה #{ride_id[:8]}",
        "type": 400,
        "date": None,          # today
        "dueDate": None,
        "lang": "he",
        "currency": "ILS",
        "vatType": 0,          # 0 = inclusive VAT (מחיר כולל מע"מ)
        "income": [
            {
                "description": description or "נסיעת מונית",
                "quantity": 1,
                "price": float(amount_ils),
                "currency": "ILS",
                "vatType": 0,
            }
        ],
        "client": {
            "name": passenger_name or "נוסע",
            "emails": [passenger_email] if passenger_email else [],
            "add": True,
        },
        "payment": [
            {
                "type": 4,     # 4 = אשראי
                "price": float(amount_ils),
                "currency": "ILS",
                "date": None,
            }
        ],
    }

    async with httpx.AsyncClient(
        base_url=_GI_BASE,
        headers={"Authorization": f"Bearer {jwt}"},
        timeout=15.0,
    ) as client:
        resp = await client.post("/documents", json=payload)
        if resp.status_code not in (200, 201):
            # Log but don't crash the ride flow
            import logging
            logging.getLogger(__name__).warning(
                "GreenInvoice receipt failed ride=%s: %s", ride_id, resp.text[:200]
            )
            return None
        data = resp.json()
        return data.get("url")  # PDF URL


async def create_tax_invoice(
    ride_id: str,
    passenger_name: str,
    passenger_email: str | None,
    business_name: str,
    business_tax_id: str | None,
    amount_ils: Decimal,
    description: str = "",
) -> str | None:
    """
    Issue a tax invoice + receipt (חשבונית מס קבלה — document type 405)
    for a business-profile ride. Auto-emailed to the business email.

    Returns the document URL (PDF), or None if not configured.
    """
    if not _is_configured():
        return None

    jwt = await _get_jwt()
    payload = {
        "description": description or f"נסיעה עסקית #{ride_id[:8]}",
        "type": 405,
        "date": None,
        "dueDate": None,
        "lang": "he",
        "currency": "ILS",
        "vatType": 0,
        "income": [
            {
                "description": description or "נסיעת מונית עסקית",
                "quantity": 1,
                "price": float(amount_ils),
                "currency": "ILS",
                "vatType": 0,
            }
        ],
        "client": {
            "name": business_name,
            "taxId": business_tax_id or "",
            "emails": [passenger_email] if passenger_email else [],
            "add": True,
        },
        "payment": [
            {
                "type": 4,
                "price": float(amount_ils),
                "currency": "ILS",
                "date": None,
            }
        ],
    }

    async with httpx.AsyncClient(
        base_url=_GI_BASE,
        headers={"Authorization": f"Bearer {jwt}"},
        timeout=15.0,
    ) as client:
        resp = await client.post("/documents", json=payload)
        if resp.status_code not in (200, 201):
            import logging
            logging.getLogger(__name__).warning(
                "GreenInvoice tax invoice failed ride=%s: %s", ride_id, resp.text[:200]
            )
            return None
        return resp.json().get("url")

"""
Green Invoice / Morning webhook receiver
========================================
Endpoint:  POST /webhooks/greeninvoice
Auth:      HMAC-SHA256 of raw body using GREENINVOICE_WEBHOOK_SECRET,
           sent by Green Invoice in the header:  X-Greeninvoice-Signature

Events we handle:
  document.add       — document created (receipt / tax-invoice)
  document.update    — document status changed
  payment.add        — payment recorded against a document

Green Invoice signs with:  HMAC-SHA256( raw_body, webhook_secret )
Header value format:       sha256=<hex_digest>
"""

import hashlib
import hmac
import logging

from fastapi import APIRouter, HTTPException, Request, status

from core.config import settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
log = logging.getLogger(__name__)


def _verify_signature(raw_body: bytes, header: str | None) -> bool:
    """Return True if the HMAC header matches the expected digest."""
    secret = settings.GREENINVOICE_WEBHOOK_SECRET
    if not secret:
        # Webhook secret not configured — skip verification (dev mode)
        log.warning("GREENINVOICE_WEBHOOK_SECRET not set; skipping signature check")
        return True
    if not header:
        return False
    # Header is expected as: "sha256=<hex>"
    prefix = "sha256="
    if not header.startswith(prefix):
        return False
    received_hex = header[len(prefix):]
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received_hex)


@router.post("/greeninvoice", status_code=status.HTTP_200_OK)
async def greeninvoice_webhook(request: Request):
    raw_body = await request.body()
    sig_header = request.headers.get("X-Greeninvoice-Signature")

    if not _verify_signature(raw_body, sig_header):
        log.warning("Green Invoice webhook: invalid signature — rejecting")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event") or payload.get("type") or "unknown"
    doc   = payload.get("data", {})

    log.info("Green Invoice webhook: event=%s id=%s", event, doc.get("id", "—"))

    # ── document.add ─────────────────────────────────────────────────────────
    if event in ("document.add", "document.create"):
        doc_type  = doc.get("type")
        doc_number = doc.get("number")
        doc_url   = doc.get("url") or doc.get("documentUrl")
        client    = doc.get("client", {})
        log.info(
            "New document: type=%s number=%s client=%s url=%s",
            doc_type, doc_number, client.get("name"), doc_url,
        )
        # TODO: store doc_url against the ride/passenger for display in wallet

    # ── document.update ──────────────────────────────────────────────────────
    elif event in ("document.update", "document.change"):
        doc_id     = doc.get("id")
        new_status = doc.get("status") or doc.get("state")
        log.info("Document updated: id=%s new_status=%s", doc_id, new_status)

    # ── payment.add ──────────────────────────────────────────────────────────
    elif event in ("payment.add", "payment.create"):
        amount   = doc.get("amount") or doc.get("sum")
        currency = doc.get("currency", "ILS")
        log.info("Payment recorded: amount=%s %s", amount, currency)

    else:
        log.info("Unhandled Green Invoice event: %s", event)

    # Green Invoice expects HTTP 200 to confirm delivery
    return {"received": True, "event": event}

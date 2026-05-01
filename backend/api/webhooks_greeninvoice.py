"""
Green Invoice / Morning webhook receiver
========================================
Endpoint:  POST /webhooks/greeninvoice
Auth:      HMAC-SHA256 of raw body using GREENINVOICE_WEBHOOK_SECRET,
           sent by Green Invoice in the header:  X-Greeninvoice-Signature

Events handled:
  document/created        — new document (receipt / tax-invoice / credit-note)
  client/created          — new client added
  supplier/created        — new supplier added
  payment/received        — payment recorded against a document
  sale-pages/page-contacted  — lead from sale page (contact form)
  sale-pages/order-paid      — paid order from sale page
  expense-draft/parsed    — AI parsed an expense draft from email/file
  expense-draft/declined  — expense draft was declined
  expense/file-updated    — file attached to an expense changed
  file/infected           — uploaded file flagged as malware (drop it)

  Legacy dot-notation aliases (just in case):
  document.add / document.update / payment.add
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
        log.warning("GREENINVOICE_WEBHOOK_SECRET not set; skipping signature check")
        return True
    if not header:
        return False
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

    # Green Invoice sends event as e.g. "document/created"
    event = payload.get("event") or payload.get("type") or "unknown"
    data  = payload.get("data", {})

    log.info("Green Invoice webhook: event=%s", event)

    # ── document/created ─────────────────────────────────────────────────────
    if event in ("document/created", "document.add", "document.create"):
        doc_type   = data.get("type")
        doc_number = data.get("number")
        doc_url    = data.get("url") or data.get("documentUrl")
        client     = data.get("client", {})
        amount     = data.get("amount") or data.get("sum")
        log.info(
            "New document: type=%s number=%s client=%s amount=%s url=%s",
            doc_type, doc_number, client.get("name"), amount, doc_url,
        )
        # TODO: persist doc_url on the ride record so the passenger can view it

    # ── client/created ───────────────────────────────────────────────────────
    elif event == "client/created":
        client_id   = data.get("id")
        client_name = data.get("name")
        log.info("New client created: id=%s name=%s", client_id, client_name)

    # ── supplier/created ─────────────────────────────────────────────────────
    elif event == "supplier/created":
        supplier_id   = data.get("id")
        supplier_name = data.get("name")
        log.info("New supplier created: id=%s name=%s", supplier_id, supplier_name)

    # ── payment/received ─────────────────────────────────────────────────────
    elif event in ("payment/received", "payment.add", "payment.create"):
        amount   = data.get("amount") or data.get("sum")
        currency = data.get("currency", "ILS")
        doc_id   = data.get("documentId") or data.get("document", {}).get("id")
        log.info("Payment received: amount=%s %s for document=%s", amount, currency, doc_id)

    # ── sale-pages/page-contacted ────────────────────────────────────────────
    elif event == "sale-pages/page-contacted":
        contact_name  = data.get("name")
        contact_email = data.get("email")
        contact_phone = data.get("phone")
        page_name     = data.get("pageName") or data.get("page", {}).get("name")
        log.info(
            "Sale page contact: name=%s email=%s phone=%s page=%s",
            contact_name, contact_email, contact_phone, page_name,
        )

    # ── sale-pages/order-paid ────────────────────────────────────────────────
    elif event == "sale-pages/order-paid":
        order_id  = data.get("id")
        amount    = data.get("amount") or data.get("sum")
        currency  = data.get("currency", "ILS")
        buyer     = data.get("client", {})
        log.info(
            "Sale page order paid: order=%s amount=%s %s buyer=%s",
            order_id, amount, currency, buyer.get("name"),
        )

    # ── expense-draft/parsed ─────────────────────────────────────────────────
    elif event == "expense-draft/parsed":
        draft_id  = data.get("id")
        vendor    = data.get("description") or data.get("supplierName")
        amount    = data.get("amount") or data.get("sum")
        log.info("Expense draft parsed: id=%s vendor=%s amount=%s", draft_id, vendor, amount)

    # ── expense-draft/declined ───────────────────────────────────────────────
    elif event == "expense-draft/declined":
        draft_id = data.get("id")
        reason   = data.get("reason") or data.get("description")
        log.info("Expense draft declined: id=%s reason=%s", draft_id, reason)

    # ── expense/file-updated ─────────────────────────────────────────────────
    elif event == "expense/file-updated":
        expense_id = data.get("id")
        file_url   = data.get("fileUrl") or data.get("url")
        log.info("Expense file updated: id=%s url=%s", expense_id, file_url)

    # ── file/infected ────────────────────────────────────────────────────────
    elif event == "file/infected":
        file_name = data.get("fileName") or data.get("name")
        file_id   = data.get("id")
        log.error(
            "SECURITY ALERT — infected file detected by Green Invoice: id=%s name=%s",
            file_id, file_name,
        )
        # Do NOT process the file — log only

    # ── document.update (legacy) ─────────────────────────────────────────────
    elif event in ("document.update", "document.change"):
        doc_id     = data.get("id")
        new_status = data.get("status") or data.get("state")
        log.info("Document updated: id=%s new_status=%s", doc_id, new_status)

    else:
        log.info("Unhandled Green Invoice event: %s  data_keys=%s", event, list(data.keys()))

    return {"received": True, "event": event}

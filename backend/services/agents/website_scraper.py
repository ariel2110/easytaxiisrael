"""
Website Scraper — extracts contact details (phone, email) from a business website.

Uses httpx + regex only (no external HTML parsing libraries needed).
Called after Google Places search to enrich leads that have a website URL.
"""
from __future__ import annotations

import logging
import re

import httpx

log = logging.getLogger(__name__)

# Israeli phone patterns (raw, before normalization)
_PHONE_RE = re.compile(
    r"""
    (?<!\d)           # not preceded by digit
    (
      0[5][0-9]       # mobile: 050-059
      [\s\-.]?
      \d{3}
      [\s\-.]?
      \d{4}
      |
      0[23489]        # landline: 02,03,04,08,09
      [\s\-.]?
      \d{3}
      [\s\-.]?
      \d{4}
      |
      \+?972          # international format
      [\s\-.]?
      [5][0-9]
      [\s\-.]?
      \d{3}
      [\s\-.]?
      \d{4}
    )
    (?!\d)            # not followed by digit
    """,
    re.VERBOSE,
)

_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8",
}


def _normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"[^\d]", "", raw)
    if digits.startswith("972") and len(digits) >= 11:
        return digits[:13]
    if digits.startswith("0") and len(digits) >= 9:
        return "972" + digits[1:]
    return None


def _is_mobile(e164: str) -> bool:
    return e164[3:].startswith("5") if e164 else False


async def scrape_contacts(url: str) -> dict[str, list[str]]:
    """
    Fetch a URL and extract Israeli phone numbers and email addresses.

    Returns:
        {
            "phones": ["972501234567", ...],   # E.164, mobile first
            "mobile_phones": ["972501234567"],
            "landline_phones": ["97232123456"],
            "emails": ["info@example.co.il"],
        }
    """
    if not url:
        return {"phones": [], "mobile_phones": [], "landline_phones": [], "emails": []}

    # Ensure scheme
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=_HEADERS) as client:
            resp = await client.get(url)
            html = resp.text
    except Exception as exc:
        log.debug("[website_scraper] Failed to fetch %s: %s", url, exc)
        return {"phones": [], "mobile_phones": [], "landline_phones": [], "emails": []}

    # Extract phones
    raw_phones = _PHONE_RE.findall(html)
    seen_phones: set[str] = set()
    mobile: list[str] = []
    landline: list[str] = []

    for raw in raw_phones:
        e164 = _normalize_phone(raw)
        if not e164 or e164 in seen_phones:
            continue
        seen_phones.add(e164)
        if _is_mobile(e164):
            mobile.append(e164)
        else:
            landline.append(e164)

    # Extract emails (deduplicated, lowercase, skip common generic/spam)
    _SKIP_DOMAINS = {"sentry.io", "example.com", "yourdomain", "wixpress.com"}
    seen_emails: set[str] = set()
    emails: list[str] = []
    for em in _EMAIL_RE.findall(html):
        em_lower = em.lower()
        if em_lower in seen_emails:
            continue
        if any(d in em_lower for d in _SKIP_DOMAINS):
            continue
        seen_emails.add(em_lower)
        emails.append(em_lower)

    all_phones = mobile + landline
    log.debug("[website_scraper] %s → %d phones, %d emails", url, len(all_phones), len(emails))
    return {
        "phones": all_phones,
        "mobile_phones": mobile,
        "landline_phones": landline,
        "emails": emails[:5],  # cap at 5 emails
    }

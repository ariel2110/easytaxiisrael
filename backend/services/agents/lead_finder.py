"""
Lead Finder Agent — searches Google Places for taxi/rideshare drivers across all of Israel.

Supports 7 geographic regions. Can run a single region or all of Israel.
Extracts phone, website, and normalizes contact info.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import httpx

from core.config import settings

log = logging.getLogger(__name__)

# ── Israeli Regions ───────────────────────────────────────────────────────────
# Each region: (lat, lng, radius_m, city_hints, queries)

_REGIONS: dict[str, dict] = {
    "center": {
        "label": "מרכז / גוש דן",
        "lat": 32.0853, "lng": 34.7818, "radius": 30000,
        "cities": ["תל אביב", "פתח תקווה", "רמת גן", "בני ברק", "חולון", "בת ים",
                   "גבעתיים", "הרצליה", "כפר סבא", "ראשון לציון", "ראש העין"],
        "queries": [
            "מונית תל אביב", "שירות מונית גוש דן", "נהג מונית פרטי",
            "מוניות פתח תקווה", "מוניות רמת גן", "מוניות בני ברק",
            "מוניות חולון בת ים", "taxi tel aviv", "cab driver tel aviv",
        ],
    },
    "sharon": {
        "label": "שרון / נתניה",
        "lat": 32.3215, "lng": 34.8532, "radius": 25000,
        "cities": ["נתניה", "כפר סבא", "הוד השרון", "רעננה", "כפר יונה", "טירה", "טול כרם"],
        "queries": [
            "מוניות נתניה", "מונית שרון", "נהג מונית נתניה",
            "מוניות רעננה", "מוניות כפר סבא", "taxi netanya",
        ],
    },
    "haifa": {
        "label": "חיפה והצפון",
        "lat": 32.8156, "lng": 35.0000, "radius": 35000,
        "cities": ["חיפה", "קריות", "עכו", "נהריה", "כרמיאל", "טבריה", "צפת"],
        "queries": [
            "מוניות חיפה", "מונית קריות", "נהג מונית חיפה",
            "מוניות עכו נהריה", "מוניות כרמיאל", "taxi haifa",
            "מוניות טבריה", "מוניות צפת",
        ],
    },
    "jerusalem": {
        "label": "ירושלים",
        "lat": 31.7683, "lng": 35.2137, "radius": 22000,
        "cities": ["ירושלים", "בית שמש", "מעלה אדומים", "גבעת זאב"],
        "queries": [
            "מוניות ירושלים", "נהג מונית ירושלים", "שירות מוניות ירושלים",
            "מוניות בית שמש", "taxi jerusalem",
        ],
    },
    "south": {
        "label": "דרום / באר שבע",
        "lat": 31.2530, "lng": 34.7915, "radius": 40000,
        "cities": ["באר שבע", "אשדוד", "אשקלון", "קריית גת", "דימונה", "אילת"],
        "queries": [
            "מוניות באר שבע", "מונית הנגב", "נהג מונית דרום",
            "מוניות אשדוד", "מוניות אשקלון", "taxi beer sheva",
        ],
    },
    "coastal": {
        "label": "שפלה / שרון דרומי",
        "lat": 31.8040, "lng": 34.6553, "radius": 25000,
        "cities": ["ראשון לציון", "רחובות", "לוד", "רמלה", "יבנה", "נס ציונה"],
        "queries": [
            "מוניות ראשון לציון", "מוניות רחובות", "מוניות לוד רמלה",
            "מוניות יבנה", "taxi rishon lezion",
        ],
    },
    "galilee": {
        "label": "גליל / נצרת",
        "lat": 32.6996, "lng": 35.3035, "radius": 35000,
        "cities": ["נצרת", "עפולה", "בית שאן", "מגדל העמק", "טמרה", "שפרעם"],
        "queries": [
            "מוניות נצרת", "מונית גליל", "נהג מונית עפולה",
            "מוניות בית שאן", "taxi nazareth",
        ],
    },
}

_ALL_CITIES = [city for r in _REGIONS.values() for city in r["cities"]]


# ── Phone helpers ─────────────────────────────────────────────────────────────

def _normalize_phone(raw: str) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"[^\d+]", "", raw).lstrip("+")
    if digits.startswith("972") and len(digits) >= 11:
        return digits[:13]
    if digits.startswith("0") and len(digits) >= 9:
        return "972" + digits[1:]
    return None


def _is_whatsapp_capable(phone_e164: str) -> bool:
    if not phone_e164:
        return False
    return phone_e164[3:].startswith("5")  # 05x mobile


# ── City detection ────────────────────────────────────────────────────────────

def _city_from_text(name: str, address: str, region_cities: list[str]) -> str:
    combined = f"{name} {address}"
    for city in region_cities:
        if city in combined:
            return city
    for city in _ALL_CITIES:
        if city in combined:
            return city
    for p in reversed(address.split(",")):
        p = p.strip()
        if p and not re.match(r"^\d", p) and "Israel" not in p and "ישראל" not in p:
            return p
    return ""


# ── Main search function ──────────────────────────────────────────────────────

async def find_taxi_leads(
    max_results: int = 50,
    region: str = "all",
    city: str | None = None,
    google_api_key: str | None = None,
) -> list[dict[str, Any]]:
    """
    Search Google Places for taxi drivers/businesses across Israel.

    region: 'all' | 'center' | 'sharon' | 'haifa' | 'jerusalem' | 'south' | 'coastal' | 'galilee'
    city:   optional city filter (applied as substring match on results)
    """
    key = google_api_key or settings.GOOGLE_MAPS_API_KEY
    if not key:
        log.warning("[lead_finder] No GOOGLE_MAPS_API_KEY configured")
        return []

    regions_to_search = list(_REGIONS.values()) if region == "all" else [_REGIONS[region]] if region in _REGIONS else list(_REGIONS.values())

    seen_place_ids: set[str] = set()
    seen_phones: set[str] = set()
    results: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for reg in regions_to_search:
            if len(results) >= max_results:
                break
            reg_results = await _search_region(
                client, key, reg, max_results - len(results), seen_place_ids, seen_phones
            )
            # Apply city filter if requested
            if city:
                reg_results = [r for r in reg_results if city in (r.get("area") or "")]
            results.extend(reg_results)

    # Hot leads first (WhatsApp capable), then by name
    results.sort(key=lambda r: (0 if r.get("whatsapp_capable") else 1, r.get("name") or ""))

    log.info(
        "[lead_finder] Total: %d leads (%d WA, %d email, %d with site)",
        len(results),
        sum(1 for r in results if r.get("whatsapp_capable")),
        sum(1 for r in results if r.get("email")),
        sum(1 for r in results if r.get("website")),
    )
    return results


async def _search_region(
    client: httpx.AsyncClient,
    key: str,
    reg: dict,
    budget: int,
    seen_place_ids: set[str],
    seen_phones: set[str],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    for query in reg["queries"]:
        if len(results) >= budget:
            break
        try:
            places = await _text_search(client, key, query, reg["lat"], reg["lng"], reg["radius"])
        except Exception as exc:
            log.warning("[lead_finder] Text search failed '%s': %s", query, exc)
            continue

        for place in places:
            if len(results) >= budget:
                break

            place_id = place.get("place_id", "")
            if not place_id or place_id in seen_place_ids:
                continue
            seen_place_ids.add(place_id)

            try:
                details = await _get_place_details(client, key, place_id)
            except Exception as exc:
                log.debug("[lead_finder] Details failed %s: %s", place_id, exc)
                details = {}

            phone_raw = details.get("phone")
            address = details.get("address") or place.get("formatted_address", "")
            website = details.get("website")
            name = place.get("name", "")

            phone = _normalize_phone(phone_raw) if phone_raw else None

            if phone and phone in seen_phones:
                continue
            if phone:
                seen_phones.add(phone)

            city_val = _city_from_text(name, address, reg["cities"])
            is_taxi = any(w in (name + address).lower() for w in ["מונית", "מוניות", "taxi", "cab", "מינית"])

            lead: dict[str, Any] = {
                "name": name[:120] if name else None,
                "phone": phone,
                "whatsapp_capable": _is_whatsapp_capable(phone) if phone else False,
                "area": city_val or reg["label"],
                "business_type": "מונית" if is_taxi else "נהג",
                "google_place_id": place_id,
                "source": "google_places",
                "website": website,
                "email": None,  # populated by website scraper in the API layer
                "notes": f"מקור: Google Places | {query} | {address[:80]}",
            }
            results.append(lead)

    return results


# ── Google Places API calls ───────────────────────────────────────────────────

async def _text_search(
    client: httpx.AsyncClient,
    key: str,
    query: str,
    lat: float,
    lng: float,
    radius: int,
) -> list[dict]:
    r = await client.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        params={
            "query": query,
            "location": f"{lat},{lng}",
            "radius": radius,
            "language": "iw",
            "key": key,
        },
    )
    r.raise_for_status()
    data = r.json()
    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        log.warning("[lead_finder] Places API status=%s query='%s' msg=%s", status, query, data.get("error_message", ""))
    return data.get("results", [])


async def _get_place_details(
    client: httpx.AsyncClient,
    key: str,
    place_id: str,
) -> dict:
    """Return {phone, address, website} for a place_id."""
    r = await client.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        params={
            "place_id": place_id,
            "fields": "formatted_phone_number,international_phone_number,formatted_address,website",
            "language": "iw",
            "key": key,
        },
    )
    r.raise_for_status()
    result = r.json().get("result", {})
    return {
        "phone": result.get("international_phone_number") or result.get("formatted_phone_number"),
        "address": result.get("formatted_address", ""),
        "website": result.get("website"),
    }


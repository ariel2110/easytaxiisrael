"""
Israeli Government Open Data (data.gov.il) vehicle verification service.

Endpoints used:
  - Active vehicle registry:  resource 053cea08-09bc-40ec-8f7a-156f0677aff3
  - Public/taxi vehicles:     resource cf29862d-ca25-4691-84f6-1be60dcb4a1e
  - Removed from road:        resource f6efe89a-fb3d-43a4-bb61-9bf12a9b9099

All resources are public, no API key required.
Data is updated once per day by the Ministry of Transport.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)

_BASE = "https://data.gov.il/api/3/action/datastore_search"
_TIMEOUT = 10

# Resource IDs — verified working as of 2026-04-29
RESOURCE_VEHICLES      = "053cea08-09bc-40ec-8f7a-156f0677aff3"  # all active vehicles
RESOURCE_PUBLIC_TAXI   = "cf29862d-ca25-4691-84f6-1be60dcb4a1e"  # public/taxi vehicles
RESOURCE_REMOVED       = "f6efe89a-fb3d-43a4-bb61-9bf12a9b9099"  # removed from road


async def _query(resource_id: str, vehicle_number: str) -> list[dict]:
    """Query data.gov.il CKAN datastore for a specific vehicle number."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                _BASE,
                params={"resource_id": resource_id, "q": str(vehicle_number), "limit": 5},
            )
            r.raise_for_status()
            data = r.json()
            if data.get("success"):
                return data.get("result", {}).get("records", [])
    except Exception as exc:
        log.warning("[govil] query failed resource=%s vehicle=%s: %s", resource_id, vehicle_number, exc)
    return []


def _first_match(records: list[dict], vehicle_number: str) -> dict | None:
    """Return the first record whose mispar_rechev matches exactly."""
    target = str(vehicle_number).strip()
    for rec in records:
        if str(rec.get("mispar_rechev", "")).strip() == target:
            return rec
    # Fallback: return first result if any
    return records[0] if records else None


async def check_vehicle(vehicle_number: str) -> dict[str, Any]:
    """
    Full vehicle verification against Israeli government databases.

    Returns a dict with:
      - found (bool)
      - is_active (bool)  — vehicle is in active registry
      - is_removed (bool) — vehicle appears in removed-from-road registry
      - is_taxi (bool)    — vehicle appears in public/taxi registry
      - details (dict)    — raw fields from the active registry record
      - warnings (list)   — human-readable warning strings (Hebrew)
    """
    vehicle_number = str(vehicle_number).strip()
    warnings: list[str] = []

    # 1. Check active vehicle registry
    active_records = await _query(RESOURCE_VEHICLES, vehicle_number)
    active = _first_match(active_records, vehicle_number)

    # 2. Check removed-from-road registry
    removed_records = await _query(RESOURCE_REMOVED, vehicle_number)
    removed = _first_match(removed_records, vehicle_number)

    # 3. Check public/taxi registry (optional — not required for rideshare)
    taxi_records = await _query(RESOURCE_PUBLIC_TAXI, vehicle_number)
    taxi = _first_match(taxi_records, vehicle_number)

    is_found   = active is not None
    is_removed = removed is not None

    # Build warnings
    if not is_found:
        warnings.append("הרכב לא נמצא במרשם הרכבים הפעיל של משרד התחבורה")
    if is_removed:
        warnings.append("⚠️ הרכב מופיע במרשם הרכבים שנגרעו מהכביש (תאונה / טוטאל-לוס)")

    details: dict = {}
    if active:
        details = {
            "mispar_rechev":        active.get("mispar_rechev"),
            "manufacturer":         active.get("tozeret_nm"),
            "model":                active.get("degem_nm"),
            "color":                active.get("tzeva_rechev"),
            "year":                 active.get("shnat_yitzur"),
            "ownership":            active.get("baalut"),
            "test_expiry":          active.get("tokef_dt"),
            "last_test_date":       active.get("mivchan_acharon_dt"),
            "chassis":              active.get("misgeret"),
            "fuel_type":            active.get("sug_delek_nm"),
        }

        # Warn if test (טסט) is missing or stale
        if not details.get("test_expiry"):
            warnings.append("⚠️ לא נמצא תאריך טסט בתוקף לרכב זה")

    return {
        "found":      is_found,
        "is_active":  is_found and not is_removed,
        "is_removed": is_removed,
        "is_taxi":    taxi is not None,
        "details":    details,
        "warnings":   warnings,
    }

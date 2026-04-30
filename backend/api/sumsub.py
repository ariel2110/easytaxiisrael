"""
Sumsub KYC API endpoints

Driver routes:
  POST /sumsub/token          → get WebSDK access token (driver auth required)
  GET  /sumsub/status         → check own applicant status

Admin routes:
  GET  /admin/sumsub/applicants          → list all applicants
  GET  /admin/sumsub/applicants/{id}     → detail for one applicant

Webhook:
  POST /sumsub/webhook        → Sumsub event callbacks (no auth, HMAC-verified)
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.sumsub import SumsubApplicant
from models.user import User, UserRole
from services import sumsub as sumsub_svc

log = logging.getLogger(__name__)

router = APIRouter(tags=["sumsub"])


# ── Driver routes ─────────────────────────────────────────────────────────────

@router.post("/sumsub/token", status_code=200)
async def get_sdk_token(
    body: dict,
    current_user: User = Depends(require_roles(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return a fresh Sumsub WebSDK access token for the authenticated driver."""
    driver_type = body.get("driver_type", "rideshare")
    if driver_type not in ("rideshare", "licensed_taxi"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="driver_type must be 'rideshare' or 'licensed_taxi'",
        )

    token, level_name = await sumsub_svc.get_or_create_token(
        db,
        driver_id=str(current_user.id),
        phone=current_user.phone,
        driver_type=driver_type,
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not generate verification token. Try again later.",
        )

    return {
        "token": token,
        "level_name": level_name,
    }


@router.get("/sumsub/status", status_code=200)
async def get_status(
    current_user: User = Depends(require_roles(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Driver checks their own latest Sumsub applicant status."""
    result = await db.execute(
        select(SumsubApplicant)
        .where(SumsubApplicant.driver_id == current_user.id)
        .order_by(SumsubApplicant.created_at.desc())
        .limit(1)
    )
    applicant = result.scalar_one_or_none()
    if not applicant:
        return {"status": "not_started", "applicant": None}

    return {
        "status": applicant.status.value,
        "level_name": applicant.level_name,
        "review_result": applicant.review_result,
        "auth_status": current_user.auth_status.value,
    }


@router.get("/sumsub/my-data", status_code=200)
async def get_my_data(
    current_user: User = Depends(require_roles(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Driver fetches their verified identity data extracted from Sumsub."""
    from sqlalchemy import text

    # Get latest applicant
    result = await db.execute(
        select(SumsubApplicant)
        .where(SumsubApplicant.driver_id == current_user.id)
        .order_by(SumsubApplicant.created_at.desc())
        .limit(1)
    )
    applicant = result.scalar_one_or_none()

    # Try driver_verified_data table first (populated by webhook)
    vd = await db.execute(
        text("SELECT * FROM driver_verified_data WHERE driver_id = :did ORDER BY verified_at DESC LIMIT 1"),
        {"did": str(current_user.id)},
    )
    vd_row = vd.mappings().first()

    extracted: dict = {}

    if vd_row:
        extracted = {
            "first_name": vd_row.get("verified_name_first"),
            "last_name": vd_row.get("verified_name_last"),
            "date_of_birth": str(vd_row.get("date_of_birth")) if vd_row.get("date_of_birth") else None,
            "id_number": vd_row.get("id_number"),
            "id_expiry": str(vd_row.get("gov_id_expiry")) if vd_row.get("gov_id_expiry") else None,
            "issuing_country": vd_row.get("issuing_country"),
            "license_number": vd_row.get("license_number"),
            "license_class": vd_row.get("license_class"),
            "gov_id_passed": bool(vd_row.get("gov_id_passed")),
            "selfie_passed": bool(vd_row.get("selfie_passed")),
        }
    elif applicant and applicant.status.value in ("pending", "completed"):
        # Fetch from Sumsub API
        info = await sumsub_svc.get_applicant_info(applicant.sumsub_applicant_id)
        if info:
            personal = info.get("info", {})
            docs = personal.get("idDocs", [])
            first_doc = docs[0] if docs else {}
            extracted = {
                "first_name": personal.get("firstName") or first_doc.get("firstName"),
                "last_name": personal.get("lastName") or first_doc.get("lastName"),
                "date_of_birth": personal.get("dob") or first_doc.get("dob"),
                "id_number": first_doc.get("number"),
                "id_expiry": first_doc.get("validUntil"),
                "issuing_country": first_doc.get("issuingCountry") or personal.get("country"),
                "license_number": None,
                "license_class": None,
                "gov_id_passed": applicant.review_result == "GREEN",
                "selfie_passed": applicant.review_result == "GREEN",
            }

    return {
        "status": applicant.status.value if applicant else "not_started",
        "review_result": applicant.review_result if applicant else None,
        "level_name": applicant.level_name if applicant else None,
        "auth_status": current_user.auth_status.value,
        "full_name": current_user.full_name,
        "extracted": extracted,
    }


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/sumsub/webhook", status_code=200)
async def webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_payload_digest: str | None = Header(default=None, alias="X-Payload-Digest"),
) -> dict:
    """Receive and process Sumsub webhook events."""
    body = await request.body()

    # Verify HMAC signature
    if x_payload_digest:
        if not sumsub_svc.verify_webhook_signature(body, x_payload_digest):
            log.warning("[sumsub] webhook signature mismatch")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    await sumsub_svc.process_webhook(db, payload)
    return {"ok": True}


# ── Admin routes ──────────────────────────────────────────────────────────────

@router.get("/admin/sumsub/applicants", status_code=200)
async def admin_list_applicants(
    filter_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    _: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: list all Sumsub applicants."""
    from models.sumsub import SumsubStatus
    query = select(SumsubApplicant).order_by(SumsubApplicant.created_at.desc())

    if filter_status:
        try:
            query = query.where(SumsubApplicant.status == SumsubStatus(filter_status))
        except ValueError:
            raise HTTPException(422, detail=f"Invalid status: {filter_status}")

    query = query.limit(min(limit, 200)).offset(offset)
    result = await db.execute(query)
    rows = result.scalars().all()

    return {
        "total": len(rows),
        "applicants": [
            {
                "id": str(r.id),
                "driver_id": str(r.driver_id),
                "sumsub_applicant_id": r.sumsub_applicant_id,
                "level_name": r.level_name,
                "status": r.status.value,
                "review_result": r.review_result,
                "reject_labels": json.loads(r.reject_labels) if r.reject_labels else [],
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat(),
            }
            for r in rows
        ],
    }


# ── Gov.il vehicle checks ─────────────────────────────────────────────────────

@router.post("/driver/vehicle-check", status_code=200)
async def driver_vehicle_check(
    body: dict,
    current_user: User = Depends(require_roles(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Driver submits their vehicle plate number → verified against gov.il."""
    from services.govil import check_vehicle
    from sqlalchemy import text

    vehicle_number = str(body.get("vehicle_number", "")).strip()
    if not vehicle_number or len(vehicle_number) < 5:
        raise HTTPException(status_code=422, detail="מספר רכב לא תקין")

    result = await check_vehicle(vehicle_number)

    # Persist vehicle_number on the user
    await db.execute(
        text("UPDATE users SET vehicle_number = :vn WHERE id = :uid"),
        {"vn": vehicle_number, "uid": str(current_user.id)},
    )

    # Cache check result
    await db.execute(
        text("""
            INSERT INTO govil_vehicle_checks
              (driver_id, vehicle_number, found, is_active, is_removed, is_taxi,
               manufacturer, model, color, year, ownership, test_expiry,
               last_test_date, chassis, fuel_type, warnings)
            VALUES
              (:driver_id, :vn, :found, :is_active, :is_removed, :is_taxi,
               :manufacturer, :model, :color, :year, :ownership, :test_expiry,
               :last_test_date, :chassis, :fuel_type, :warnings)
        """),
        {
            "driver_id":    str(current_user.id),
            "vn":           vehicle_number,
            "found":        result["found"],
            "is_active":    result["is_active"],
            "is_removed":   result["is_removed"],
            "is_taxi":      result["is_taxi"],
            "manufacturer": result["details"].get("manufacturer"),
            "model":        result["details"].get("model"),
            "color":        result["details"].get("color"),
            "year":         str(result["details"].get("year") or ""),
            "ownership":    result["details"].get("ownership"),
            "test_expiry":  result["details"].get("test_expiry"),
            "last_test_date": result["details"].get("last_test_date"),
            "chassis":      result["details"].get("chassis"),
            "fuel_type":    result["details"].get("fuel_type"),
            "warnings":     "\n".join(result["warnings"]),
        },
    )
    await db.commit()

    return result


@router.get("/admin/vehicle-check/{driver_id}", status_code=200)
async def admin_vehicle_check(
    driver_id: str,
    _: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: get latest vehicle check result for a driver."""
    from sqlalchemy import text
    r = await db.execute(
        text("""
            SELECT * FROM govil_vehicle_checks
            WHERE driver_id = :did
            ORDER BY checked_at DESC LIMIT 1
        """),
        {"did": driver_id},
    )
    row = r.mappings().first()
    if not row:
        return {"found": False, "message": "לא בוצעה בדיקת רכב עדיין"}
    return dict(row)


@router.post("/admin/vehicle-check/{driver_id}/run", status_code=200)
async def admin_run_vehicle_check(
    driver_id: str,
    _: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Admin: manually trigger a fresh vehicle check for a driver."""
    from services.govil import check_vehicle
    from sqlalchemy import text

    r = await db.execute(
        text("SELECT vehicle_number FROM users WHERE id = :uid"),
        {"uid": driver_id},
    )
    row = r.mappings().first()
    if not row or not row.get("vehicle_number"):
        raise HTTPException(400, detail="הנהג לא הזין מספר רכב עדיין")

    result = await check_vehicle(row["vehicle_number"])

    await db.execute(
        text("""
            INSERT INTO govil_vehicle_checks
              (driver_id, vehicle_number, found, is_active, is_removed, is_taxi,
               manufacturer, model, color, year, ownership, test_expiry,
               last_test_date, chassis, fuel_type, warnings)
            VALUES
              (:driver_id, :vn, :found, :is_active, :is_removed, :is_taxi,
               :manufacturer, :model, :color, :year, :ownership, :test_expiry,
               :last_test_date, :chassis, :fuel_type, :warnings)
        """),
        {
            "driver_id":    driver_id,
            "vn":           row["vehicle_number"],
            "found":        result["found"],
            "is_active":    result["is_active"],
            "is_removed":   result["is_removed"],
            "is_taxi":      result["is_taxi"],
            "manufacturer": result["details"].get("manufacturer"),
            "model":        result["details"].get("model"),
            "color":        result["details"].get("color"),
            "year":         str(result["details"].get("year") or ""),
            "ownership":    result["details"].get("ownership"),
            "test_expiry":  result["details"].get("test_expiry"),
            "last_test_date": result["details"].get("last_test_date"),
            "chassis":      result["details"].get("chassis"),
            "fuel_type":    result["details"].get("fuel_type"),
            "warnings":     "\n".join(result["warnings"]),
        },
    )
    await db.commit()
    return result

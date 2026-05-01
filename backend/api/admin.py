"""
Admin API — platform management endpoints (admin role only).

GET  /admin/users                    — list all users (paginated)
GET  /admin/users/{id}               — get single user
PATCH /admin/users/{id}/activate     — activate user
PATCH /admin/users/{id}/deactivate   — deactivate user
GET  /admin/drivers                  — list drivers with compliance + wallet
GET  /admin/stats                    — platform-wide statistics
GET  /admin/audit-logs               — recent audit trail (paginated)
GET  /admin/rides                    — all rides (paginated, filterable by status)
GET  /admin/system-health            — deep system health (DB, Redis, WA, agents)
GET  /admin/daily-report             — get cached AI strategic report
POST /admin/daily-report/generate    — generate new AI strategic report
"""

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.dependencies import require_admin_key
from models.audit import AuditAction, AuditLog
from models.payment import DriverWallet, RidePayment
from models.rating import Rating, RatingDirection
from models.ride import Ride, RideStatus
from models.user import User, UserRole, AuthStatus, DriverType
from security.audit import audit

router = APIRouter(prefix="/admin", tags=["admin"])
_admin = require_admin_key


# ---------------------------------------------------------------------------
# Schemas (admin-only — not reused elsewhere)
# ---------------------------------------------------------------------------

class UserAdminRead(BaseModel):
    id: uuid.UUID
    phone: str
    role: str
    driver_type: str | None = None
    auth_status: str | None = None
    is_active: bool
    full_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DriverAdminRead(BaseModel):
    id: uuid.UUID
    phone: str
    is_active: bool
    wallet_balance: float | None
    average_rating: float | None
    total_ratings: int
    created_at: datetime


class PlatformStats(BaseModel):
    total_users: int
    total_drivers: int
    total_passengers: int
    active_drivers: int
    total_rides: int
    completed_rides: int
    cancelled_rides: int
    pending_rides: int
    total_revenue: float
    total_payments: int
    pending_approvals: int = 0


class AuditLogRead(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    detail: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserAdminRead], summary="List all users")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: UserRole | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> list[UserAdminRead]:
    q = select(User).offset(skip).limit(limit).order_by(User.created_at.desc())
    if role:
        q = q.where(User.role == role)
    result = await db.execute(q)
    return [UserAdminRead.model_validate(u) for u in result.scalars().all()]


@router.get("/users/{user_id}", response_model=UserAdminRead, summary="Get a single user")
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserAdminRead.model_validate(user)


@router.patch(
    "/users/{user_id}/activate",
    response_model=UserAdminRead,
    summary="Activate a user account",
)
async def activate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = True
    await audit(db, AuditAction.admin_evaluate_driver, actor_id=admin.id,
                resource_type="user", resource_id=str(user_id),
                detail="activated")
    await db.commit()
    await db.refresh(user)
    return UserAdminRead.model_validate(user)


@router.patch(
    "/users/{user_id}/deactivate",
    response_model=UserAdminRead,
    summary="Deactivate (ban) a user account",
)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot deactivate an admin account",
        )
    user.is_active = False
    await audit(db, AuditAction.admin_evaluate_driver, actor_id=admin.id,
                resource_type="user", resource_id=str(user_id),
                detail="deactivated")
    await db.commit()
    await db.refresh(user)
    return UserAdminRead.model_validate(user)


@router.patch(
    "/users/{user_id}/approve",
    response_model=UserAdminRead,
    summary="Approve a driver — set auth_status=approved",
)
async def approve_driver(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != UserRole.driver:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a driver")
    user.auth_status = AuthStatus.approved
    user.is_active = True
    await audit(db, AuditAction.admin_evaluate_driver, actor_id=admin.id,
                resource_type="user", resource_id=str(user_id),
                detail="approved")
    await db.commit()
    await db.refresh(user)
    return UserAdminRead.model_validate(user)


class SetDriverTypeRequest(BaseModel):
    driver_type: Literal["licensed_taxi", "rideshare"]


@router.patch(
    "/users/{user_id}/driver-type",
    response_model=UserAdminRead,
    summary="Set driver type (licensed_taxi / rideshare)",
)
async def set_driver_type(
    user_id: uuid.UUID,
    body: SetDriverTypeRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> UserAdminRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != UserRole.driver:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a driver")
    user.driver_type = DriverType(body.driver_type)
    await audit(db, AuditAction.admin_evaluate_driver, actor_id=admin.id,
                resource_type="user", resource_id=str(user_id),
                detail=f"driver_type set to {body.driver_type}")
    await db.commit()
    await db.refresh(user)
    return UserAdminRead.model_validate(user)


# ---------------------------------------------------------------------------
# Driver overview
# ---------------------------------------------------------------------------

@router.get("/drivers", response_model=list[DriverAdminRead], summary="List drivers with stats")
async def list_drivers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> list[DriverAdminRead]:
    q = select(User).where(User.role == UserRole.driver).offset(skip).limit(limit)
    if active_only:
        q = q.where(User.is_active.is_(True))
    drivers_result = await db.execute(q)
    drivers = list(drivers_result.scalars().all())
    driver_ids = [d.id for d in drivers]

    # Wallet balances
    wallets_result = await db.execute(
        select(DriverWallet).where(DriverWallet.driver_id.in_(driver_ids))
    )
    wallet_map = {w.driver_id: float(w.balance) for w in wallets_result.scalars().all()}

    # Average ratings
    ratings_result = await db.execute(
        select(
            Rating.ratee_id,
            func.avg(Rating.score).label("avg"),
            func.count(Rating.id).label("cnt"),
        )
        .where(
            Rating.ratee_id.in_(driver_ids),
            Rating.direction == RatingDirection.passenger_to_driver,
        )
        .group_by(Rating.ratee_id)
    )
    rating_map = {row.ratee_id: (round(float(row.avg), 2), row.cnt) for row in ratings_result}

    out = []
    for d in drivers:
        avg, cnt = rating_map.get(d.id, (None, 0))
        out.append(DriverAdminRead(
            id=d.id,
            phone=d.phone,
            is_active=d.is_active,
            wallet_balance=wallet_map.get(d.id),
            average_rating=avg,
            total_ratings=cnt,
            created_at=d.created_at,
        ))
    return out


# ---------------------------------------------------------------------------
# Platform statistics
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=PlatformStats, summary="Platform-wide statistics")
async def platform_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> PlatformStats:
    # User counts
    user_counts = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    role_count: dict[str, int] = {row[0].value: row[1] for row in user_counts}

    active_drivers_r = await db.execute(
        select(func.count(User.id)).where(
            User.role == UserRole.driver,
            User.is_active.is_(True),
        )
    )

    # Pending approvals (drivers not yet approved)
    pending_approvals_r = await db.execute(
        select(func.count(User.id)).where(
            User.role == UserRole.driver,
            User.auth_status.notin_([AuthStatus.approved]),
            User.is_active.is_(True),
        )
    )

    # Ride counts
    ride_counts = await db.execute(
        select(Ride.status, func.count(Ride.id)).group_by(Ride.status)
    )
    status_count: dict[str, int] = {row[0].value: row[1] for row in ride_counts}

    # Revenue (sum of platform_fee for completed payments)
    revenue_r = await db.execute(
        select(func.sum(RidePayment.platform_fee)).where(
            RidePayment.status.in_(["completed"])
        )
    )
    revenue = float(revenue_r.scalar() or 0)

    total_payments_r = await db.execute(select(func.count(RidePayment.id)))

    return PlatformStats(
        total_users=sum(role_count.values()),
        total_drivers=role_count.get("driver", 0),
        total_passengers=role_count.get("passenger", 0),
        active_drivers=active_drivers_r.scalar() or 0,
        total_rides=sum(status_count.values()),
        completed_rides=status_count.get("completed", 0),
        cancelled_rides=status_count.get("cancelled", 0),
        pending_rides=status_count.get("pending", 0),
        total_revenue=revenue,
        total_payments=total_payments_r.scalar() or 0,
        pending_approvals=pending_approvals_r.scalar() or 0,
    )


# ---------------------------------------------------------------------------
# Pending approvals list
# ---------------------------------------------------------------------------

@router.get("/pending-approvals", summary="List drivers pending approval")
async def list_pending_approvals(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> dict:
    """Return all drivers not yet approved, enriched with Sumsub data."""
    from models.sumsub import SumsubApplicant
    from security.encryption import decrypt_field
    from sqlalchemy import text as _text
    import json as _json

    # Use raw SQL to avoid ORM bulk-decrypt crashing on rows with stale keys
    raw = await db.execute(_text("""
        SELECT id, phone, full_name, driver_type, auth_status, is_active, created_at
        FROM users
        WHERE role = 'driver'
          AND auth_status NOT IN ('approved')
          AND is_active = true
        ORDER BY created_at DESC
    """))
    rows = raw.mappings().all()

    STATUS_LABEL = {
        "pending": "⏳ ממתין לאימות",
        "whatsapp_verified": "📱 וואטסאפ אומת",
        "persona_in_progress": "🔄 KYC בתהליך",
        "persona_completed": "✅ KYC הושלם — ממתין לאישור",
        "rejected": "❌ נדחה",
        "on_hold": "⏸️ בהמתנה",
    }

    def _safe_decrypt(val: str | None) -> str | None:
        if not val:
            return None
        try:
            return decrypt_field(val)
        except Exception:
            return None  # corrupted / old-key ciphertext

    # Build items list with safe per-row decryption
    items_raw = []
    for row in rows:
        uid = str(row["id"])
        auth_status = row["auth_status"] or "pending"
        items_raw.append({
            "id": uid,
            "phone": _safe_decrypt(row["phone"]),
            "full_name": row["full_name"],  # plain String column, not encrypted
            "driver_type": row["driver_type"],
            "auth_status": auth_status,
            "auth_status_label": STATUS_LABEL.get(auth_status, auth_status),
            "is_active": row["is_active"],
            "created_at": row["created_at"].isoformat(),
        })

    # Load latest sumsub record per driver
    driver_ids = [r["id"] for r in items_raw]
    sumsub_rows: dict[str, dict] = {}
    if driver_ids:
        sa_result = await db.execute(
            select(SumsubApplicant)
            .where(SumsubApplicant.driver_id.in_(driver_ids))
            .order_by(SumsubApplicant.updated_at.desc())
        )
        for row in sa_result.scalars().all():
            key = str(row.driver_id)
            if key not in sumsub_rows:
                sumsub_rows[key] = {
                    "sumsub_id": row.sumsub_applicant_id,
                    "level": row.level_name,
                    "sumsub_status": row.status.value,
                    "review_result": row.review_result,
                    "reject_labels": _json.loads(row.reject_labels) if row.reject_labels else [],
                    "sumsub_updated_at": row.updated_at.isoformat(),
                }

    items = [{**item, **sumsub_rows.get(item["id"], {})} for item in items_raw]
    return {"total": len(items), "items": items}


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@router.get("/audit-logs", response_model=list[AuditLogRead], summary="Recent audit trail")
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    actor_id: uuid.UUID | None = Query(None),
    action: AuditAction | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> list[AuditLogRead]:
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    if actor_id:
        q = q.where(AuditLog.actor_id == actor_id)
    if action:
        q = q.where(AuditLog.action == action)
    result = await db.execute(q)
    return [AuditLogRead.model_validate(r) for r in result.scalars().all()]


# ---------------------------------------------------------------------------
# Rides overview
# ---------------------------------------------------------------------------

@router.get("/rides", response_model=list[dict], summary="All rides (admin view, paginated)")
async def list_all_rides(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    ride_status: RideStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
) -> list[dict]:
    q = select(Ride).order_by(Ride.created_at.desc()).offset(skip).limit(limit)
    if ride_status:
        q = q.where(Ride.status == ride_status)
    result = await db.execute(q)
    rides = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "status": r.status.value,
            "passenger_id": str(r.passenger_id),
            "driver_id": str(r.driver_id) if r.driver_id else None,
            "pickup_address": r.pickup_address,
            "dropoff_address": r.dropoff_address,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in rides
    ]


# ---------------------------------------------------------------------------
# System Health
# ---------------------------------------------------------------------------

_AGENT_DEFS = [
    {"id": "dispatch",           "name": "Dispatch Agent",       "icon": "🚗", "key_field": "GROQ_API_KEY",       "model": "Llama 3.1 70B"},
    {"id": "compliance",         "name": "Compliance Agent",     "icon": "⚖️", "key_field": "ANTHROPIC_API_KEY",  "model": "Claude 3.5 Sonnet"},
    {"id": "onboarding",         "name": "Onboarding Agent",     "icon": "📄", "key_field": "OPENAI_API_KEY",     "model": "GPT-4o Vision"},
    {"id": "kyc_primary",        "name": "KYC Primary Agent",    "icon": "🪪", "key_field": "OPENAI_API_KEY",     "model": "GPT-4o Vision"},
    {"id": "kyc_reviewer",       "name": "KYC Reviewer Agent",   "icon": "🔍", "key_field": "ANTHROPIC_API_KEY",  "model": "Claude 3.5 Sonnet"},
    {"id": "support",            "name": "Support Agent",        "icon": "💬", "key_field": "OPENAI_API_KEY",     "model": "GPT-4o mini"},
    {"id": "orchestrator",       "name": "Orchestrator Agent",   "icon": "🎯", "key_field": "GOOGLE_AI_API_KEY",  "model": "Gemini 1.5 Pro"},
    {"id": "strategic_architect","name": "Strategic Architect",  "icon": "📈", "key_field": "ANTHROPIC_API_KEY",  "model": "Claude Sonnet 4.5"},
]


def _mask(value: str | None) -> str | None:
    if not value:
        return None
    return value[:8] + "..." + value[-4:] if len(value) > 12 else "***"


@router.get("/system-health", summary="Deep system health check — DB, Redis, WhatsApp, agents, LLM keys")
async def system_health(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from core.redis import redis_client
    from services.whatsapp import _meta_enabled

    # DB health
    try:
        await db.execute(select(func.count(User.id)))
        db_ok = True
    except Exception:
        db_ok = False

    # Redis health
    try:
        await redis_client.ping()
        redis_ok = True
        redis_info = await redis_client.info("memory") if hasattr(redis_client, "info") else {}
        redis_mem = redis_info.get("used_memory_human", "N/A") if isinstance(redis_info, dict) else "N/A"
    except Exception:
        redis_ok = False
        redis_mem = "N/A"

    # WhatsApp health
    try:
        from services import whatsapp as wa_svc
        wa_info = await wa_svc.get_instance_info()
        wa_state = await wa_svc.get_connection_state()
        wa_ok = wa_state in ("open", "CONNECTED")
        wa_provider = "meta" if _meta_enabled() else "evolution"
        wa_phone = (wa_info or {}).get("owner_phone") or (wa_info or {}).get("owner", "")
        wa_phone = wa_phone.replace("@s.whatsapp.net", "") if wa_phone else None
        wa_quality = (wa_info or {}).get("quality_rating", "UNKNOWN")
        wa_profile = (wa_info or {}).get("profileName") or (wa_info or {}).get("profile_name")
    except Exception:
        wa_ok = False
        wa_provider = "meta" if _meta_enabled() else "evolution"
        wa_phone = None
        wa_quality = "UNKNOWN"
        wa_profile = None
        wa_state = "unknown"

    # LLM keys status
    llm_keys = {
        "openai":    bool(settings.OPENAI_API_KEY),
        "anthropic": bool(settings.ANTHROPIC_API_KEY),
        "groq":      bool(getattr(settings, "GROQ_API_KEY", None)),
        "google":    bool(settings.GOOGLE_AI_API_KEY),
        "xai":       bool(getattr(settings, "XAI_API_KEY", None)),
        "deepseek":  bool(getattr(settings, "DEEPSEEK_API_KEY", None)),
    }

    # Agent statuses
    key_map = {
        "OPENAI_API_KEY":    bool(settings.OPENAI_API_KEY),
        "ANTHROPIC_API_KEY": bool(settings.ANTHROPIC_API_KEY),
        "GROQ_API_KEY":      bool(getattr(settings, "GROQ_API_KEY", None)),
        "GOOGLE_AI_API_KEY": bool(settings.GOOGLE_AI_API_KEY),
    }
    agents = []
    for a in _AGENT_DEFS:
        key_ok = key_map.get(a["key_field"], False)
        agents.append({
            "id": a["id"],
            "name": a["name"],
            "icon": a["icon"],
            "model": a["model"],
            "enabled": key_ok,
            "key_field": a["key_field"],
            "key_configured": key_ok,
        })

    # Quick DB counts
    try:
        user_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
        driver_count = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.driver))).scalar() or 0
        ride_count = (await db.execute(select(func.count(Ride.id)))).scalar() or 0
    except Exception:
        user_count = driver_count = ride_count = 0

    overall_ok = db_ok and redis_ok

    return {
        "overall": "ok" if overall_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "database": {"status": "ok" if db_ok else "error", "users": user_count, "drivers": driver_count, "rides": ride_count},
            "redis":    {"status": "ok" if redis_ok else "error", "memory": redis_mem},
            "whatsapp": {
                "status": "ok" if wa_ok else "warning",
                "provider": wa_provider,
                "state": wa_state,
                "phone": wa_phone,
                "profile_name": wa_profile,
                "quality_rating": wa_quality,
                "phone_number_id": settings.WHATSAPP_PHONE_NUMBER_ID,
            },
        },
        "llm_keys": llm_keys,
        "agents": agents,
        "agents_enabled_count": sum(1 for a in agents if a["enabled"]),
        "agents_total_count": len(agents),
    }


# ---------------------------------------------------------------------------
# AI Daily Report (Strategic Architect)
# ---------------------------------------------------------------------------

_REPORT_REDIS_KEY = "admin:daily_report"
_REPORT_TTL_SECONDS = 86400  # 24 hours


@router.get("/daily-report", summary="Get the latest AI strategic report (cached, generated daily)")
async def get_daily_report(_: None = Depends(_admin)) -> dict:
    from core.redis import redis_client
    import json as _json

    raw = await redis_client.get(_REPORT_REDIS_KEY)
    if not raw:
        raise HTTPException(
            status_code=404,
            detail="אין דוח זמין. לחץ 'צור דוח חדש' כדי לייצר דוח AI.",
        )
    try:
        return _json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="שגיאה בקריאת הדוח השמור")


@router.post("/daily-report/generate", summary="Generate a new AI strategic report and cache it for 24h")
async def generate_daily_report(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    import json as _json
    from core.redis import redis_client
    from services.agents.strategic_architect import StrategicArchitectAgent
    from services.whatsapp import _meta_enabled

    # Collect platform stats
    try:
        total_users    = (await db.execute(select(func.count(User.id)))).scalar() or 0
        total_drivers  = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.driver))).scalar() or 0
        active_drivers = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.driver, User.is_active == True))).scalar() or 0  # noqa
        total_pax      = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.passenger))).scalar() or 0
        total_rides    = (await db.execute(select(func.count(Ride.id)))).scalar() or 0
        completed      = (await db.execute(select(func.count(Ride.id)).where(Ride.status == RideStatus.completed))).scalar() or 0
        cancelled      = (await db.execute(select(func.count(Ride.id)).where(Ride.status == RideStatus.cancelled))).scalar() or 0
        pending        = (await db.execute(select(func.count(Ride.id)).where(Ride.status == RideStatus.pending))).scalar() or 0
        revenue_row    = await db.execute(select(func.sum(RidePayment.platform_fee)))
        revenue        = float(revenue_row.scalar() or 0.0)
        payment_count  = (await db.execute(select(func.count(RidePayment.id)))).scalar() or 0
    except Exception:
        total_users = total_drivers = active_drivers = total_pax = 0
        total_rides = completed = cancelled = pending = payment_count = 0
        revenue = 0.0

    stats = {
        "total_users": total_users,
        "total_drivers": total_drivers,
        "active_drivers": active_drivers,
        "total_passengers": total_pax,
        "total_rides": total_rides,
        "completed_rides": completed,
        "cancelled_rides": cancelled,
        "pending_rides": pending,
        "total_revenue": revenue,
        "total_payments": payment_count,
    }

    # Agent statuses
    key_map = {
        "OPENAI_API_KEY":    bool(settings.OPENAI_API_KEY),
        "ANTHROPIC_API_KEY": bool(settings.ANTHROPIC_API_KEY),
        "GROQ_API_KEY":      bool(getattr(settings, "GROQ_API_KEY", None)),
        "GOOGLE_AI_API_KEY": bool(settings.GOOGLE_AI_API_KEY),
    }
    agents_status = [
        {"name": a["name"], "enabled": key_map.get(a["key_field"], False), "model": a["model"]}
        for a in _AGENT_DEFS
    ]

    # WhatsApp status
    try:
        from services import whatsapp as wa_svc
        wa_info = await wa_svc.get_instance_info()
        wa_state = await wa_svc.get_connection_state()
        wa_dict = {
            "provider": "meta" if _meta_enabled() else "evolution",
            "state": wa_state,
            "owner_phone": (wa_info or {}).get("owner_phone") or (wa_info or {}).get("owner", ""),
            "quality_rating": (wa_info or {}).get("quality_rating", "UNKNOWN"),
        }
    except Exception:
        wa_dict = {"provider": "meta" if _meta_enabled() else "evolution", "state": "unknown"}

    # DB/Redis health
    try:
        await db.execute(select(func.count(User.id)))
        db_health = "ok"
    except Exception:
        db_health = "error"

    try:
        from core.redis import redis_client
        await redis_client.ping()
        redis_health = "ok"
    except Exception:
        redis_health = "error"

    # Run agent
    agent = StrategicArchitectAgent()
    result = await agent.run({
        "stats": stats,
        "agents_status": agents_status,
        "whatsapp": wa_dict,
        "db_health": db_health,
        "redis_health": redis_health,
    })

    report = result.data or {}
    report["model_used"] = result.model_used
    report["generated_at"] = datetime.now(timezone.utc).isoformat()

    # Cache in Redis for 24h
    from core.redis import redis_client as rc
    await rc.set(_REPORT_REDIS_KEY, _json.dumps(report, ensure_ascii=False), ex=_REPORT_TTL_SECONDS)

    return report


# ---------------------------------------------------------------------------
# Demo Seed
# ---------------------------------------------------------------------------

_DEMO_REDIS_KEY  = "admin:demo_report"
_DEMO_TTL        = 60 * 60 * 24 * 7  # 7 days


@router.get("/demo-report", summary="Get cached demo seed report")
async def get_demo_report(_: None = Depends(_admin)) -> dict:
    import json as _json
    from core.redis import redis_client

    raw = await redis_client.get(_DEMO_REDIS_KEY)
    if not raw:
        raise HTTPException(
            status_code=404,
            detail="לא נמצא דוח דמו. הרץ POST /admin/seed-demo תחילה.",
        )
    return _json.loads(raw)


@router.post("/seed-demo", summary="Seed demo drivers, passengers, and 10 ride scenarios")
async def seed_demo(
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    import json as _json
    from core.redis import redis_client
    from scripts.seed_demo import seed_demo as _run_seed

    result = await _run_seed(db, force=force)

    # Cache result in Redis for 7 days
    await redis_client.set(_DEMO_REDIS_KEY, _json.dumps(result, ensure_ascii=False, default=str), ex=_DEMO_TTL)

    return result


# ---------------------------------------------------------------------------
# Driver Leads Board
# ---------------------------------------------------------------------------

@router.get("/leads", summary="List driver leads (filterable, paginated)")
async def list_leads(
    status_filter: str | None = Query(None, alias="status"),
    whatsapp_only: bool = Query(False),
    area: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=200),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from models.growth import Lead, LeadStatus
    from sqlalchemy import and_, or_

    conditions = []
    if status_filter:
        try:
            conditions.append(Lead.status == LeadStatus(status_filter))
        except ValueError:
            pass
    if whatsapp_only:
        conditions.append(Lead.whatsapp_capable == True)  # noqa: E712
    if area:
        conditions.append(Lead.area.ilike(f"%{area}%"))
    if search:
        conditions.append(or_(
            Lead.name.ilike(f"%{search}%"),
            Lead.phone.ilike(f"%{search}%"),
            Lead.area.ilike(f"%{search}%"),
            Lead.email.ilike(f"%{search}%"),
        ))

    base_q = select(Lead)
    if conditions:
        base_q = base_q.where(and_(*conditions))

    # Hot leads first (WA capable), then by created_at desc
    base_q = base_q.order_by(
        Lead.whatsapp_capable.desc(),
        Lead.status.asc(),
        Lead.created_at.desc(),
    )

    total_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    skip = (page - 1) * page_size
    rows = (await db.execute(base_q.offset(skip).limit(page_size))).scalars().all()

    import math
    total_pages = max(1, math.ceil(total / page_size))

    def _fmt(lead: "Lead") -> dict:
        return {
            "id": str(lead.id),
            "phone": lead.phone,
            "name": lead.name,
            "status": lead.status.value,
            "source": lead.source.value,
            "whatsapp_capable": lead.whatsapp_capable,
            "message_text": lead.message_text,
            "area": lead.area,
            "business_type": lead.business_type,
            "email": lead.email,
            "website": lead.website,
            "notes": lead.notes,
            "approved_at": lead.approved_at.isoformat() if lead.approved_at else None,
            "sent_at": lead.sent_at.isoformat() if lead.sent_at else None,
            "created_at": lead.created_at.isoformat(),
        }

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": [_fmt(r) for r in rows],
    }


@router.post("/leads/find", summary="Find taxi driver leads via Google Places")
async def find_leads(
    max_results: int = Query(50, le=200),
    region: str = Query("all", description="all | center | sharon | haifa | jerusalem | south | coastal | galilee"),
    city: str | None = Query(None, description="Filter to a specific city (substring match)"),
    google_api_key: str | None = Query(None, description="Override GOOGLE_MAPS_API_KEY"),
    scrape_websites: bool = Query(True, description="Scrape websites for additional contacts"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from models.growth import Lead, LeadSource, LeadStatus
    from services.agents.lead_finder import find_taxi_leads
    from services.agents.website_scraper import scrape_contacts

    raw_leads = await find_taxi_leads(
        max_results=max_results,
        region=region,
        city=city,
        google_api_key=google_api_key,
    )

    # Scrape websites for email/extra phones
    if scrape_websites:
        for lead_data in raw_leads:
            if lead_data.get("website"):
                try:
                    scraped = await scrape_contacts(lead_data["website"])
                    # Use first scraped email
                    if scraped.get("emails") and not lead_data.get("email"):
                        lead_data["email"] = scraped["emails"][0]
                    # If no WA phone, try scraped mobile
                    if not lead_data.get("phone") and scraped.get("mobile_phones"):
                        lead_data["phone"] = scraped["mobile_phones"][0]
                        lead_data["whatsapp_capable"] = True
                    elif not lead_data.get("phone") and scraped.get("landline_phones"):
                        lead_data["phone"] = scraped["landline_phones"][0]
                except Exception:
                    pass

    inserted = 0
    skipped_no_phone = 0
    skipped_duplicate = 0
    wa_count = 0
    email_count = 0

    for lead_data in raw_leads:
        phone = lead_data.get("phone")

        # Leads without phone still saved — marked as non-WA
        if not phone:
            phone = f"NOPHONE_{lead_data['google_place_id']}"
            skipped_no_phone += 1

        # Skip if already exists (any status — including rejected)
        existing = (await db.execute(select(Lead).where(Lead.phone == phone))).scalar_one_or_none()
        if existing:
            skipped_duplicate += 1
            continue

        # Also skip by place_id to catch same business with different phone
        place_id = lead_data.get("google_place_id")
        if place_id:
            existing_by_place = (await db.execute(
                select(Lead).where(Lead.google_place_id == place_id)
            )).scalar_one_or_none()
            if existing_by_place:
                skipped_duplicate += 1
                continue

        email = lead_data.get("email")
        if email:
            email_count += 1
        if lead_data.get("whatsapp_capable"):
            wa_count += 1

        lead = Lead(
            phone=phone,
            name=lead_data.get("name"),
            source=LeadSource.google_places,
            status=LeadStatus.new,
            whatsapp_capable=lead_data.get("whatsapp_capable", False),
            area=lead_data.get("area"),
            business_type=lead_data.get("business_type"),
            google_place_id=lead_data.get("google_place_id"),
            website=lead_data.get("website"),
            email=email,
            notes=lead_data.get("notes"),
        )
        db.add(lead)
        inserted += 1

    await db.commit()
    return {
        "found": len(raw_leads),
        "inserted": inserted,
        "skipped_duplicate": skipped_duplicate,
        "skipped_no_phone": skipped_no_phone,
        "whatsapp_capable": wa_count,
        "with_email": email_count,
    }


@router.post("/leads/generate-messages", summary="Generate AI recruitment messages for all leads without one")
async def generate_all_messages(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from models.growth import Lead
    from services.agents.recruitment_agent import generate_message

    rows = (await db.execute(
        select(Lead).where(Lead.message_text == None)  # noqa: E711
    )).scalars().all()

    generated = 0
    for lead in rows:
        msg = await generate_message(
            name=lead.name,
            area=lead.area,
            business_type=lead.business_type,
        )
        lead.message_text = msg
        generated += 1

    await db.commit()
    return {"generated": generated}


@router.post("/leads/{lead_id}/generate-message", summary="Generate AI message for a single lead")
async def generate_one_message(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from models.growth import Lead
    from services.agents.recruitment_agent import generate_message

    lead = (await db.execute(select(Lead).where(Lead.id == uuid.UUID(lead_id)))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    msg = await generate_message(name=lead.name, area=lead.area, business_type=lead.business_type)
    lead.message_text = msg
    await db.commit()
    return {"id": lead_id, "message_text": msg}


class LeadMessageUpdate(BaseModel):
    message_text: str


@router.patch("/leads/{lead_id}/message", summary="Update (edit) lead message text")
async def update_lead_message(
    lead_id: str,
    body: LeadMessageUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from models.growth import Lead

    lead = (await db.execute(select(Lead).where(Lead.id == uuid.UUID(lead_id)))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.message_text = body.message_text
    await db.commit()
    return {"id": lead_id, "message_text": lead.message_text}


@router.post("/leads/{lead_id}/approve", summary="Approve lead for WhatsApp sending")
async def approve_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from models.growth import Lead, LeadStatus

    lead = (await db.execute(select(Lead).where(Lead.id == uuid.UUID(lead_id)))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not lead.message_text:
        raise HTTPException(status_code=422, detail="חייב להיות טקסט הודעה לפני אישור")
    lead.status = LeadStatus.approved
    lead.approved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": lead_id, "status": "approved"}


@router.post("/leads/{lead_id}/reject", summary="Reject / skip a lead")
async def reject_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from models.growth import Lead, LeadStatus

    lead = (await db.execute(select(Lead).where(Lead.id == uuid.UUID(lead_id)))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.status = LeadStatus.rejected
    await db.commit()
    return {"id": lead_id, "status": "rejected"}


@router.post("/leads/send-approved", summary="Send WhatsApp messages to all approved leads")
async def send_approved_leads(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_admin),
) -> dict:
    from models.growth import Lead, LeadStatus
    from services import whatsapp as whatsapp_svc

    approved = (await db.execute(
        select(Lead).where(Lead.status == LeadStatus.approved, Lead.whatsapp_capable == True)  # noqa: E712
    )).scalars().all()

    if not approved:
        raise HTTPException(status_code=404, detail="אין לידים מאושרים עם WhatsApp")

    sent = 0
    failed = 0
    for lead in approved:
        if not lead.message_text or not lead.phone or lead.phone.startswith("NOPHONE_"):
            failed += 1
            continue
        try:
            ok = await whatsapp_svc.send_text(lead.phone, lead.message_text)
            if ok:
                lead.status = LeadStatus.sent
                lead.sent_at = datetime.now(timezone.utc)
                sent += 1
            else:
                failed += 1
        except Exception as exc:
            failed += 1

    await db.commit()
    return {"sent": sent, "failed": failed, "total": len(approved)}

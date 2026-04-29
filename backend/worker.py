"""
ARQ background worker — rideos-platform.

Tasks:
  1. compliance_expiry_sweep   — flag/deactivate drivers with expired documents
  2. campaign_send_batch       — fire scheduled campaign messages in batches
  3. license_expiry_check      — warn/block drivers with expiring/expired licenses

Run with:
  arq worker.WorkerSettings

"""

import logging
from datetime import date, datetime, timedelta, timezone

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Task: compliance expiry sweep
# ---------------------------------------------------------------------------

async def compliance_expiry_sweep(ctx: dict) -> str:
    """Deactivate drivers whose required documents have expired."""
    async with AsyncSessionLocal() as db:
        from services.compliance import run_expiry_sweep
        results = await run_expiry_sweep(db)
    count = len(results)
    msg = f"compliance_expiry_sweep: flagged {count} drivers"
    logger.info(msg)
    return msg


# ---------------------------------------------------------------------------
# Task: campaign batch send
# ---------------------------------------------------------------------------

async def campaign_send_batch(ctx: dict) -> str:
    """Send pending campaign messages for all active campaigns (batched)."""
    async with AsyncSessionLocal() as db:
        from services.growth import send_pending_campaign_messages
        sent = await send_pending_campaign_messages(db)
    msg = f"campaign_send_batch: sent {sent} messages"
    logger.info(msg)
    return msg


# ---------------------------------------------------------------------------
# Task: driver license expiry check
# ---------------------------------------------------------------------------

async def license_expiry_check(ctx: dict) -> str:
    """
    Daily job — runs at 06:00 Israel time.

    1. Finds drivers whose license_expiry_date has passed → auto-block + WhatsApp warning.
    2. Finds drivers expiring within 30 days → WhatsApp reminder.
    3. Finds drivers whose background_check_expiry has passed → flag compliance.
    4. Finds drivers whose taxi_license_expiry has passed → flag compliance.
    """
    today = date.today()
    warn_threshold = today + timedelta(days=30)
    blocked_count = 0
    warned_count = 0

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        from models.driver_verified_data import DriverVerifiedData
        from models.compliance import DriverComplianceProfile, ComplianceStatus
        from models.user import User, AuthStatus

        # 1. Check driver's license expiry via DriverVerifiedData
        result = await db.execute(
            select(DriverVerifiedData.driver_id, DriverVerifiedData.license_expiry_date)
            .where(DriverVerifiedData.license_expiry_date.isnot(None))
            .distinct(DriverVerifiedData.driver_id)
            .order_by(DriverVerifiedData.driver_id, DriverVerifiedData.verified_at.desc())
        )
        rows = result.all()

        for driver_id, expiry in rows:
            if expiry is None:
                continue

            if expiry < today:
                # Expired — block driver
                res = await db.execute(
                    select(DriverComplianceProfile).where(
                        DriverComplianceProfile.driver_id == driver_id
                    )
                )
                profile = res.scalar_one_or_none()
                if profile and not profile.auto_blocked:
                    profile.compliance_status = ComplianceStatus.blocked
                    profile.auto_blocked = True
                    profile.block_reason = f"רישיון נהיגה פג תוקף ב-{expiry}"
                    blocked_count += 1
                    # WhatsApp warning
                    try:
                        user_res = await db.execute(select(User).where(User.id == driver_id))
                        user = user_res.scalar_one_or_none()
                        if user:
                            from services.whatsapp import send_text
                            await send_text(
                                user.phone,
                                f"⚠️ *EasyTaxi* — רישיון הנהיגה שלך פג תוקף ב-{expiry}.\n\n"
                                "החשבון שלך הושעה זמנית.\n"
                                "יש לחדש את הרישיון ולעדכן אותנו.",
                            )
                    except Exception as exc:
                        logger.warning("Failed to send license expiry WA to %s: %s", driver_id, exc)

            elif expiry <= warn_threshold:
                # Expiring soon — send reminder
                try:
                    user_res = await db.execute(select(User).where(User.id == driver_id))
                    user = user_res.scalar_one_or_none()
                    if user:
                        from services.whatsapp import send_text
                        days_left = (expiry - today).days
                        await send_text(
                            user.phone,
                            f"📋 *EasyTaxi* — תזכורת: רישיון הנהיגה שלך יפוג תוקף בעוד {days_left} ימים ({expiry}).\n\n"
                            "יש לחדש אותו כדי להמשיך לקבל נסיעות.",
                        )
                        warned_count += 1
                except Exception as exc:
                    logger.warning("Failed to send license warning WA to %s: %s", driver_id, exc)

        # 2. Check background_check_expiry
        bgc_result = await db.execute(
            select(DriverComplianceProfile).where(
                DriverComplianceProfile.background_check_approved.is_(True),
                DriverComplianceProfile.background_check_expiry < today,
            )
        )
        for profile in bgc_result.scalars().all():
            profile.background_check_approved = False
            profile.block_reason = (profile.block_reason or "") + " | אישור יושרה פג תוקף"
            blocked_count += 1

        # 3. Check taxi_license_expiry
        taxi_result = await db.execute(
            select(DriverComplianceProfile).where(
                DriverComplianceProfile.taxi_license_approved.is_(True),
                DriverComplianceProfile.taxi_license_expiry < today,
            )
        )
        for profile in taxi_result.scalars().all():
            profile.taxi_license_approved = False
            blocked_count += 1

        await db.commit()

    msg = f"license_expiry_check: blocked={blocked_count} warned={warned_count}"
    logger.info(msg)
    return msg


# ---------------------------------------------------------------------------
# Startup / shutdown hooks
# ---------------------------------------------------------------------------

async def startup(ctx: dict) -> None:
    logger.info("ARQ worker starting up")


async def shutdown(ctx: dict) -> None:
    logger.info("ARQ worker shutting down")


# ---------------------------------------------------------------------------
# Worker settings
# ---------------------------------------------------------------------------

class WorkerSettings:
    functions = [compliance_expiry_sweep, campaign_send_batch, license_expiry_check]

    cron_jobs = [
        # Compliance sweep: every hour, minute 5
        cron(compliance_expiry_sweep, hour=None, minute=5),
        # Campaign send: every 15 minutes
        cron(campaign_send_batch, minute={0, 15, 30, 45}),
        # License expiry check: daily at 04:00 UTC (= 06:00 Israel time / 07:00 DST)
        cron(license_expiry_check, hour=4, minute=0),
    ]

    on_startup = startup
    on_shutdown = shutdown

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 300  # 5 minutes max per job
    keep_result = 3600  # keep result in Redis for 1 hour

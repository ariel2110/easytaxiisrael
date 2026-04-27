"""
ARQ background worker — rideos-platform.

Tasks:
  1. compliance_expiry_sweep   — flag/deactivate drivers with expired documents
  2. campaign_send_batch       — fire scheduled campaign messages in batches

Run with:
  arq worker.WorkerSettings

"""

import logging
from datetime import datetime, timezone

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
    functions = [compliance_expiry_sweep, campaign_send_batch]

    cron_jobs = [
        # Compliance sweep: every hour, minute 5
        cron(compliance_expiry_sweep, hour=None, minute=5),
        # Campaign send: every 15 minutes
        cron(campaign_send_batch, minute={0, 15, 30, 45}),
    ]

    on_startup = startup
    on_shutdown = shutdown

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 300  # 5 minutes max per job
    keep_result = 3600  # keep result in Redis for 1 hour

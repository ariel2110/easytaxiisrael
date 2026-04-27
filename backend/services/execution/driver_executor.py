"""
Execution Layer — driver onboarding DB updates.
Called only after Decision Engine has made an approval/rejection decision.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.compliance import DriverComplianceProfile
from models.user import User
from security.audit import AuditAction, audit
from services.events import DriverEvent, event_bus

log = logging.getLogger(__name__)


async def approve_driver_onboarding(
    db: AsyncSession,
    driver_id: uuid.UUID,
    decision_metadata: dict,
    admin_id: uuid.UUID | None = None,
) -> None:
    """Mark driver as active and compliance approved after successful onboarding."""
    driver = await db.get(User, driver_id)
    if driver is None:
        raise ValueError(f"Driver {driver_id} not found")

    driver.is_active = True  # type: ignore[attr-defined]

    # Update or create compliance profile
    stmt = select(DriverComplianceProfile).where(
        DriverComplianceProfile.driver_id == driver_id
    )
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = DriverComplianceProfile(driver_id=driver_id)
        db.add(profile)

    profile.is_compliant = True  # type: ignore[attr-defined]
    profile.compliance_score = float(decision_metadata.get("confidence", 1.0))  # type: ignore[attr-defined]

    await audit(
        db, AuditAction.admin_evaluate_driver,
        actor_id=admin_id,
        resource_type="user",
        resource_id=str(driver_id),
        ip_address="",
        user_agent="",
        detail=f"APPROVED onboarding: {decision_metadata.get('reason', '')}",
    )
    await db.commit()
    await event_bus.publish_driver_event(
        DriverEvent.onboarding_completed, str(driver_id)
    )
    log.info("[execution] driver %s approved for onboarding", driver_id)


async def reject_driver_onboarding(
    db: AsyncSession,
    driver_id: uuid.UUID,
    reason: str,
    admin_id: uuid.UUID | None = None,
) -> None:
    """Mark driver onboarding as rejected."""
    driver = await db.get(User, driver_id)
    if driver is None:
        raise ValueError(f"Driver {driver_id} not found")

    driver.is_active = False  # type: ignore[attr-defined]

    stmt = select(DriverComplianceProfile).where(
        DriverComplianceProfile.driver_id == driver_id
    )
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = DriverComplianceProfile(driver_id=driver_id)
        db.add(profile)

    profile.is_compliant = False  # type: ignore[attr-defined]
    profile.compliance_score = 0.0  # type: ignore[attr-defined]

    await audit(
        db, AuditAction.admin_evaluate_driver,
        actor_id=admin_id,
        resource_type="user",
        resource_id=str(driver_id),
        ip_address="",
        user_agent="",
        detail=f"REJECTED onboarding: {reason}",
    )
    await db.commit()
    await event_bus.publish_driver_event(
        DriverEvent.onboarding_rejected, str(driver_id), {"reason": reason}
    )
    log.info("[execution] driver %s rejected: %s", driver_id, reason)

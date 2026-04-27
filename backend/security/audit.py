"""
Audit log service — fire-and-forget helper to record security events.

Usage::

    from security.audit import audit
    await audit(db, AuditAction.login, actor_id=user.id, request=request)

All writes are best-effort: failures are logged but never raised to the caller.
"""

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from models.audit import AuditAction, AuditLog

logger = logging.getLogger(__name__)


async def audit(
    db: AsyncSession,
    action: AuditAction,
    *,
    actor_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    detail: str | None = None,
) -> None:
    """Append an immutable audit record. Never raises."""
    try:
        entry = AuditLog(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            detail=detail,
        )
        db.add(entry)
        await db.flush()
    except Exception:
        logger.exception("Failed to write audit log for action=%s actor=%s", action, actor_id)

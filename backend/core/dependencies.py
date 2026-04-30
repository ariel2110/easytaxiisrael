import uuid

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from core.config import settings
from core.database import get_db
from core.security import decode_access_token
from models.user import User, UserRole

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Bearer token and return the authenticated User."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise exc
    try:
        payload = decode_access_token(credentials.credentials)
        if payload.get("type") != "access":
            raise exc
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    user = await db.get(User, uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise exc
    return user


def require_roles(*roles: UserRole):
    """
    Dependency factory for role-based access control.

    Usage::

        @router.get("/admin-only")
        async def endpoint(user: User = Depends(require_roles(UserRole.admin))):
            ...
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _check


async def require_admin_key(
    x_admin_key: Optional[str] = Header(default=None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Accept either:
      - X-Admin-Key header matching EVOLUTION_API_KEY  → returns the admin User from DB
      - Bearer JWT token with admin role               → returns the authenticated User
    """
    from sqlalchemy import select
    from models.user import UserRole as _Role

    # Try JWT Bearer first
    if credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            if payload.get("type") == "access" and payload.get("role") == _Role.admin.value:
                user_id = payload.get("sub")
                if user_id:
                    user = await db.get(User, uuid.UUID(user_id))
                    if user and user.is_active:
                        return user
        except JWTError:
            pass

    # Try X-Admin-Key
    if x_admin_key and x_admin_key == settings.EVOLUTION_API_KEY:
        result = await db.execute(
            select(User).where(User.role == _Role.admin, User.is_active == True)
        )
        admin_user = result.scalars().first()
        if admin_user:
            return admin_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required",
    )

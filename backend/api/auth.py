from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.dependencies import get_current_user
from core.security import (
    create_access_token,
    create_otp,
    create_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_otp,
)
from models.audit import AuditAction
from models.user import User, UserRole
from schemas.auth import AdminLoginRequest, OTPRequest, OTPVerify, RefreshRequest, TokenResponse, UserRead
from security.audit import audit
from services import whatsapp as whatsapp_svc

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/otp/request",
    summary="Request a one-time password via phone",
    status_code=status.HTTP_200_OK,
)
async def request_otp(body: OTPRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    otp = await create_otp(body.phone)
    # Send OTP via WhatsApp (fire-and-forget; falls back gracefully if disconnected)
    await whatsapp_svc.send_otp(body.phone, otp)
    response: dict = {"message": "OTP sent"}
    if settings.DEBUG:
        response["otp"] = otp   # dev convenience — NEVER in production
    await audit(db, AuditAction.otp_requested,
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return response


@router.post(
    "/otp/verify",
    summary="Verify OTP and receive JWT tokens",
    response_model=TokenResponse,
)
async def verify_otp_and_login(
    body: OTPVerify,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    if not await verify_otp(body.phone, body.otp):
        await audit(db, AuditAction.otp_verified,
                    ip_address=request.client.host if request.client else None,
                    detail=f"FAILED for phone={body.phone}")
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP",
        )

    result = await db.execute(select(User).where(User.phone == body.phone))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(phone=body.phone, role=body.role)
        db.add(user)
        await db.flush()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    subject = str(user.id)
    access = create_access_token(subject=subject, role=user.role.value)
    refresh = await create_refresh_token(subject=subject, role=user.role.value)
    await audit(db, AuditAction.login, actor_id=user.id,
                ip_address=request.client.host if request.client else None)
    await db.commit()
    return TokenResponse(access_token=access, refresh_token=refresh, role=user.role.value)


@router.post(
    "/token/refresh",
    summary="Rotate refresh token and get a new token pair",
    response_model=TokenResponse,
)
async def refresh_tokens(body: RefreshRequest) -> TokenResponse:
    result = await rotate_refresh_token(body.refresh_token)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    access, refresh = result
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post(
    "/admin/login",
    summary="Admin password login (username + password)",
    response_model=TokenResponse,
)
async def admin_login(
    body: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    if body.username != settings.ADMIN_USERNAME or body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="שם משתמש או סיסמא שגויים",
        )
    result = await db.execute(select(User).where(User.role == UserRole.admin, User.is_active == True))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin user not found")
    subject = str(user.id)
    access = create_access_token(subject=subject, role=user.role.value)
    refresh = await create_refresh_token(subject=subject, role=user.role.value)
    return TokenResponse(access_token=access, refresh_token=refresh, role=user.role.value)


@router.post(
    "/logout",
    summary="Revoke refresh token (logout)",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    await revoke_refresh_token(body.refresh_token)
    await audit(db, AuditAction.logout, actor_id=current_user.id)
    await db.commit()


@router.get(
    "/me",
    summary="Return the currently authenticated user",
    response_model=UserRead,
)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch(
    "/me/device-token",
    summary="Register or update FCM/APNs device token for push notifications",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def update_device_token(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    token: str | None = body.get("device_token")
    if not token or not isinstance(token, str) or len(token) > 255:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="device_token must be a non-empty string (max 255 chars)",
        )
    current_user.device_token = token
    await db.commit()

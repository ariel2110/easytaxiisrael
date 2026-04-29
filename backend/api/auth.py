from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.dependencies import get_current_user
from core.redis import redis_client as _redis_client
from core.security import (
    WA_AUTH_MESSAGE_PREFIX,
    WA_AUTH_TTL_SECONDS,
    create_access_token,
    create_otp,
    create_refresh_token,
    create_wa_auth_session,
    get_wa_session_result,
    normalize_phone,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_otp,
    wa_session_is_pending,
)
from models.audit import AuditAction
from models.user import User, UserRole, AuthStatus
from schemas.auth import (
    AdminLoginRequest,
    OTPRequest,
    OTPVerify,
    ProfileUpdate,
    RefreshRequest,
    TokenResponse,
    UserRead,
    WAAuthLinkResponse,
    WAAuthPollResponse,
    WAAuthRequest,
)
from security.audit import audit
from services import persona as persona_svc
from services import whatsapp as whatsapp_svc

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# NEW: WhatsApp link authentication (primary flow)
# ---------------------------------------------------------------------------

def _build_kyc_url(user: User) -> str | None:
    """Shared helper — build Persona KYC URL for a driver."""
    return None  # will be populated below if settings are present


def _build_inquiry_url(inquiry) -> str | None:
    """Build Persona hosted-flow URL including session-token when available."""
    if not inquiry.session_token:
        return f"https://withpersona.com/verify?inquiry-id={inquiry.persona_inquiry_id}"
    return (
        f"https://withpersona.com/verify"
        f"?inquiry-id={inquiry.persona_inquiry_id}"
        f"&session-token={inquiry.session_token}"
    )


@router.post(
    "/wa/request",
    response_model=WAAuthLinkResponse,
    status_code=status.HTTP_200_OK,
    summary="התחלת אימות דרך וואטסאפ — מקבל קישור לשליחת הודעה",
)
async def request_wa_auth(body: WAAuthRequest) -> WAAuthLinkResponse:
    """
    Primary authentication method.

    1. Client submits phone + desired role.
    2. Server generates a one-time token and a wa.me deep link.
    3. User taps the link → WhatsApp opens with a pre-filled auth message.
    4. User sends the message → platform webhook processes it → JWT issued.
    5. Client polls GET /auth/wa/poll/{session_id} to receive the tokens.

    Supports any Israeli phone format:
      0546363350 | 972546363350 | +972546363350
    """
    session_id, token = await create_wa_auth_session(body.phone, body.role.value)

    # The message the user will send to the platform's WhatsApp
    auth_message = f"{WA_AUTH_MESSAGE_PREFIX} אמת אותי | {token}"

    # wa.me deep link that pre-populates the message
    import urllib.parse
    encoded_text = urllib.parse.quote(auth_message)
    # Redis override takes priority — allows live phone update without backend restart
    _phone_override = await _redis_client.get("whatsapp:platform_phone")
    platform_number = _phone_override if _phone_override else settings.WHATSAPP_PLATFORM_PHONE
    whatsapp_link = f"https://wa.me/{platform_number}?text={encoded_text}"

    return WAAuthLinkResponse(
        session_id=session_id,
        whatsapp_link=whatsapp_link,
        message_preview=auth_message,
        expires_in_seconds=WA_AUTH_TTL_SECONDS,
    )


@router.get(
    "/wa/poll/{session_id}",
    response_model=WAAuthPollResponse,
    summary="בדיקת סטטוס אימות וואטסאפ — polling",
)
async def poll_wa_auth(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> WAAuthPollResponse:
    """
    Poll for WhatsApp auth completion.
    Returns:
      - {"status": "pending"}              — user hasn't sent the message yet
      - {"status": "completed", access_token, refresh_token, role, kyc_url}
      - {"status": "expired"}              — session expired (5 min TTL)
    """
    result = await get_wa_session_result(session_id)
    if result is None:
        # Distinguish "pending" from "expired"
        if await wa_session_is_pending(session_id):
            return WAAuthPollResponse(status="pending")
        return WAAuthPollResponse(status="expired")

    # Completed — guide driver to new KYC flow
    kyc_url: str | None = None
    if result.get("role") == UserRole.driver.value:
        from core.security import decode_access_token
        try:
            payload = decode_access_token(result["access_token"])
            user_id = payload["sub"]
            from sqlalchemy import select
            res = await db.execute(select(User).where(User.id == user_id))
            user = res.scalar_one_or_none()
            if user and user.auth_status == AuthStatus.pending:
                user.auth_status = AuthStatus.persona_in_progress
                await db.commit()
        except Exception:
            pass
        kyc_url = "/kyc/application"

    return WAAuthPollResponse(
        status="completed",
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        role=result["role"],
        kyc_url=kyc_url,
    )


# ---------------------------------------------------------------------------
# OTP flow (system sends code TO user's WhatsApp — primary login method)
# ---------------------------------------------------------------------------

@router.post(
    "/otp/request",
    summary="Send a one-time password to user's WhatsApp",
    status_code=status.HTTP_200_OK,
)
async def request_otp(body: OTPRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    otp = await create_otp(body.phone)
    await whatsapp_svc.send_otp(body.phone, otp)
    response: dict = {"message": "OTP נשלח לוואטסאפ שלך"}
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

    # ── KYC: guide driver to new dual-agent verification flow ──
    kyc_url: str | None = None
    if user.role == UserRole.driver:
        if user.auth_status == AuthStatus.pending:
            user.auth_status = AuthStatus.persona_in_progress
            await db.commit()
        kyc_url = "/kyc/application"

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        role=user.role.value,
        kyc_url=kyc_url,
    )


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


@router.get(
    "/driver/kyc-status",
    summary="Poll driver KYC status from Persona",
)
async def driver_kyc_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Returns the latest Persona inquiry status for the authenticated driver.
    Frontend polls this every ~10 seconds from DriverPending.tsx.
    """
    if current_user.role != UserRole.driver:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Drivers only")

    inquiry = await persona_svc.get_latest_inquiry(db, current_user.id)
    if inquiry is None:
        return {"kyc_status": "not_started", "inquiry_id": None, "auth_status": current_user.auth_status.value}

    return {
        "kyc_status": inquiry.status.value,
        "inquiry_id": inquiry.persona_inquiry_id,
        "kyc_url": _build_inquiry_url(inquiry),
        "auth_status": current_user.auth_status.value,
    }


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


@router.patch(
    "/profile",
    response_model=UserRead,
    summary="עדכון פרטי פרופיל (שם + אימייל) — נדרש לאחר ההרשמה הראשונה",
)
async def update_profile(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    if body.full_name is not None:
        current_user.full_name = body.full_name.strip()
    if body.email is not None:
        current_user.email = body.email.lower().strip()
    await db.commit()
    await db.refresh(current_user)
    return current_user

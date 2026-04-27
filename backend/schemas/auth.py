import uuid
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from core.security import normalize_phone
from models.user import UserRole


def _phone_field() -> Field:  # type: ignore[return-type]
    """
    Accept any Israeli phone format:
      +972546363350 | 972546363350 | 0546363350
    Internally normalised to 972XXXXXXXXX.
    """
    return Field(
        ...,
        examples=["+972546363350", "972546363350", "0546363350"],
        description="Israeli phone — local (05x) or international (+972 / 972)",
    )


class PhoneNormalizeMixin(BaseModel):
    phone: str

    @field_validator("phone", mode="before")
    @classmethod
    def normalise(cls, v: str) -> str:
        import re
        digits = re.sub(r"\D", "", v)
        # must be at least 9 digits (local) or 11-12 digits (international)
        if len(digits) < 9:
            raise ValueError("מספר טלפון לא תקין")
        return normalize_phone(v)


class OTPRequest(PhoneNormalizeMixin):
    phone: str = _phone_field()


class OTPVerify(PhoneNormalizeMixin):
    phone: str = _phone_field()
    otp: str = Field(..., min_length=6, max_length=6, examples=["123456"])
    role: UserRole = Field(UserRole.passenger, description="Role assigned on first login")


class WAAuthRequest(PhoneNormalizeMixin):
    """Request a WhatsApp authentication link."""
    phone: str = _phone_field()
    role: UserRole = Field(UserRole.passenger, description="Role assigned on first login")


class WAAuthLinkResponse(BaseModel):
    """Returned after requesting a WA auth link."""
    session_id: str
    whatsapp_link: str
    message_preview: str  # what the user will send
    expires_in_seconds: int = 300


class WAAuthPollResponse(BaseModel):
    """Returned by the polling endpoint."""
    status: str  # "pending" | "completed" | "expired"
    access_token: str | None = None
    refresh_token: str | None = None
    role: str | None = None
    kyc_url: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str = "passenger"
    kyc_url: str | None = None  # Persona hosted-flow URL for drivers; null for passengers


class RefreshRequest(BaseModel):
    refresh_token: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class UserRead(BaseModel):
    id: uuid.UUID
    phone: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}

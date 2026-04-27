import uuid

from pydantic import BaseModel, Field

from models.user import UserRole


class OTPRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+?[1-9]\d{7,14}$", examples=["+14155552671"])


class OTPVerify(BaseModel):
    phone: str = Field(..., examples=["+14155552671"])
    otp: str = Field(..., min_length=6, max_length=6, examples=["123456"])
    role: UserRole = Field(UserRole.passenger, description="Role assigned on first login")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str = "passenger"


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

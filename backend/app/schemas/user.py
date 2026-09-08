from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole, VerificationStatus


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole
    location: str | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name must not be blank")
        if len(v.strip()) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("location")
    @classmethod
    def location_max_length(cls, v: str | None) -> str | None:
        if v and len(v) > 100:
            raise ValueError("Location must be 100 characters or fewer")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    location: str | None
    is_verified: bool
    verification_status: VerificationStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    location: str | None = None

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str | None) -> str | None:
        if v is not None:
            if not v.strip():
                raise ValueError("Name must not be blank")
            if len(v.strip()) > 100:
                raise ValueError("Name must be 100 characters or fewer")
            return v.strip()
        return v

    @field_validator("location")
    @classmethod
    def location_valid(cls, v: str | None) -> str | None:
        if v and len(v) > 100:
            raise ValueError("Location must be 100 characters or fewer")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole


class CitizenRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    location: str

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("location")
    @classmethod
    def location_valid(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError("Location is required")
        return v


class OfficialRegister(BaseModel):
    name: str
    email: EmailStr
    password: str = "_temp_"  # ignored — backend generates temp password after face verification
    location: str
    department: str

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v

    @field_validator("location")
    @classmethod
    def location_valid(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError("Location is required")
        return v

    @field_validator("department")
    @classmethod
    def department_valid(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError("Department is required")
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
    department: str | None
    department_id: str | None
    email_verified: bool
    face_verified: bool
    must_change_password: bool
    profile_picture_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class UserUpdate(BaseModel):
    name: str | None = None
    location: str | None = None

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v or len(v) < 2:
                raise ValueError("Name must be at least 2 characters")
        return v


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ValidateTokenResponse(BaseModel):
    email: str


class ChangePasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class RequestPasswordChangeRequest(BaseModel):
    email: EmailStr

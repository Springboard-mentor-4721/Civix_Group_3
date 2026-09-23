import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime
from sqlalchemy.sql import func
from app.database import Base


class UserRole(str, enum.Enum):
    citizen = "citizen"
    official = "official"


class User(Base):
    __tablename__ = "users"

    id                              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name                            = Column(String(100), nullable=False)
    email                           = Column(String(150), unique=True, nullable=False, index=True)
    password                        = Column(String(255), nullable=False)
    role                            = Column(Enum(UserRole), nullable=False)
    location                        = Column(String(100), nullable=True)
    department                      = Column(String(100), nullable=True)
    department_id                   = Column(String(50), nullable=True)

    # Profile photo
    profile_picture_url             = Column(String(500), nullable=True)
    profile_picture_public_id       = Column(String(255), nullable=True)

    # Email verification
    email_verified                  = Column(Boolean, default=False, nullable=False)
    email_verified_at               = Column(DateTime, nullable=True)
    email_verification_token_hash   = Column(String(255), nullable=True)
    email_verification_token_expires_at = Column(DateTime, nullable=True)

    # Face verification
    face_verified                   = Column(Boolean, default=False, nullable=False)
    face_verified_at                = Column(DateTime, nullable=True)

    # Official first-login password change
    must_change_password            = Column(Boolean, default=False, nullable=False)

    # Password reset / change token
    password_reset_token_hash       = Column(String(255), nullable=True)
    password_reset_token_expires_at = Column(DateTime, nullable=True)
    password_reset_used_at          = Column(DateTime, nullable=True)

    created_at  = Column(DateTime, nullable=False, server_default=func.now())
    updated_at  = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

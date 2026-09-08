import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime
from sqlalchemy.sql import func
from app.database import Base


class UserRole(str, enum.Enum):
    citizen = "citizen"
    official = "official"


class VerificationStatus(str, enum.Enum):
    not_required = "not_required"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    location = Column(String(100), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_status = Column(
        Enum(VerificationStatus),
        default=VerificationStatus.pending,
        nullable=False,
    )
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    email_verified_at = Column(DateTime, nullable=True)

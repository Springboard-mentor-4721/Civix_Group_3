import os
import secrets
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole, VerificationStatus
from app.schemas.user import (
    UserRegister, UserLogin, UserResponse, TokenResponse, UserUpdate,
    ResendVerificationRequest, ForgotPasswordRequest, ResetPasswordRequest,
)
from app.utils.security import hash_password, verify_password
from app.utils.jwt import create_access_token, decode_access_token
from app.utils.email import send_verification_email, send_password_reset_email

load_dotenv()

EMAIL_VERIFICATION_EXPIRE_MINUTES = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_MINUTES", "30"))
PASSWORD_RESET_EXPIRE_MINUTES     = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

_bearer_scheme = HTTPBearer()
_blacklisted_tokens: set[str] = set()

# In-memory token stores: token -> (user_id, expires_at)
_verification_tokens: dict[str, tuple[int, datetime]] = {}
_reset_tokens: dict[str, tuple[int, datetime]] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Auth dependency ────────────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    if token in _blacklisted_tokens:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been invalidated. Please login again.")
    payload = decode_access_token(token)
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    is_verified = payload.role == UserRole.citizen
    verification_status = (
        VerificationStatus.not_required if payload.role == UserRole.citizen
        else VerificationStatus.pending
    )

    user = User(
        name=payload.name,
        email=payload.email,
        password=hash_password(payload.password),
        role=payload.role,
        location=payload.location,
        is_verified=is_verified,
        verification_status=verification_status,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.role == UserRole.official and user.verification_status in (
        VerificationStatus.pending, VerificationStatus.rejected,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Official account verification is {user.verification_status.value}",
        )

    token = create_access_token(user_id=user.id, role=user.role.value)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme)):
    token = credentials.credentials
    if token in _blacklisted_tokens:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Already logged out")
    _blacklisted_tokens.add(token)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(payload: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.name is not None:
        current_user.name = payload.name
    if payload.location is not None:
        current_user.location = payload.location
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    entry = _verification_tokens.get(token)
    if not entry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token.")
    user_id, expires_at = entry
    if _utcnow() > expires_at:
        _verification_tokens.pop(token, None)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token.")
    user.email_verified_at = _utcnow()
    db.commit()
    _verification_tokens.pop(token, None)
    return {"message": "Email verified successfully."}


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    _GENERIC = "If the account exists and is not verified, a verification email has been sent."
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.email_verified_at is not None:
        return {"message": _GENERIC}
    token = secrets.token_urlsafe(32)
    _verification_tokens[token] = (user.id, _utcnow() + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES))
    print(f"[DEV] Verification token for {user.email}: {token}")
    send_verification_email(user.email, token)
    return {"message": _GENERIC}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    _GENERIC = "If an account exists with this email, a password reset link has been sent."
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"message": _GENERIC}
    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = (user.id, _utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES))
    print(f"[DEV] Password reset token for {user.email}: {token}")
    send_password_reset_email(user.email, token)
    return {"message": _GENERIC}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    entry = _reset_tokens.get(payload.token)
    if not entry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")
    user_id, expires_at = entry
    if _utcnow() > expires_at:
        _reset_tokens.pop(payload.token, None)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")
    user.password = hash_password(payload.new_password)
    db.commit()
    _reset_tokens.pop(payload.token, None)
    return {"message": "Password reset successfully."}

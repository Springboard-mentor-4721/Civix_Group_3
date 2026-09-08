import os
import secrets
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole, VerificationStatus
from app.schemas.user import (
    UserRegister, UserLogin, UserResponse, TokenResponse, UserUpdate,
    ResendVerificationRequest, ForgotPasswordRequest, ResetPasswordRequest,
)
from app.utils.security import hash_password, verify_password
from app.utils.jwt import create_access_token, decode_access_token, is_token_expired
from app.utils.email import send_verification_email, send_password_reset_email

load_dotenv()

EMAIL_VERIFICATION_EXPIRE_MINUTES = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_MINUTES", "30"))
PASSWORD_RESET_EXPIRE_MINUTES     = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))
MAX_LOGIN_ATTEMPTS                = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
LOCKOUT_MINUTES                   = int(os.getenv("LOCKOUT_MINUTES", "15"))
MAX_ACTIVE_SESSIONS               = int(os.getenv("MAX_ACTIVE_SESSIONS", "2"))

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

_bearer_scheme = HTTPBearer()

# In-memory stores
# NOTE: These reset on server restart. Use DB/Redis for production.
_blacklisted_tokens: set[str] = set()
_verification_tokens: dict[str, tuple[int, datetime]] = {}
_reset_tokens: dict[str, tuple[int, datetime]] = {}

# Rate limiting: email -> (failed_count, lockout_until | None)
_login_attempts: dict[str, tuple[int, datetime | None]] = {}

# Active sessions: user_id -> list of (token, issued_at) oldest first
_active_sessions: dict[int, list[str]] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Rate limit helpers ─────────────────────────────────────────────────────────

def _check_rate_limit(email: str) -> None:
    """Raise 429 if account is locked out."""
    entry = _login_attempts.get(email)
    if not entry:
        return
    attempts, locked_until = entry
    if locked_until and _utcnow() < locked_until:
        remaining = int((locked_until - _utcnow()).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Try again in {remaining} minute(s).",
        )
    # Lockout expired — reset
    if locked_until and _utcnow() >= locked_until:
        _login_attempts.pop(email, None)


def _record_failed_attempt(email: str) -> None:
    """Increment failed attempt counter; lock after MAX_LOGIN_ATTEMPTS."""
    entry = _login_attempts.get(email, (0, None))
    attempts = entry[0] + 1
    locked_until = None
    if attempts >= MAX_LOGIN_ATTEMPTS:
        locked_until = _utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
    _login_attempts[email] = (attempts, locked_until)


def _clear_attempts(email: str) -> None:
    """Clear failed attempts on successful login."""
    _login_attempts.pop(email, None)


# ── Session (device) limit helpers ────────────────────────────────────────────

def _register_session(user_id: int, token: str) -> None:
    """Add token to active sessions. Evict oldest if limit exceeded."""
    sessions = _active_sessions.get(user_id, [])
    # Remove blacklisted AND expired tokens — they are no longer active
    sessions = [t for t in sessions if t not in _blacklisted_tokens and not is_token_expired(t)]
    if len(sessions) >= MAX_ACTIVE_SESSIONS:
        # Evict the oldest active session
        oldest = sessions.pop(0)
        _blacklisted_tokens.add(oldest)
    sessions.append(token)
    _active_sessions[user_id] = sessions


def _remove_session(user_id: int, token: str) -> None:
    """Remove token from active sessions on logout."""
    sessions = _active_sessions.get(user_id, [])
    _active_sessions[user_id] = [t for t in sessions if t != token]


# ── Auth dependency ────────────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    if token in _blacklisted_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or logged out from another device. Please login again.",
        )
    payload = decode_access_token(token)
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# ── Register ───────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    is_citizen = payload.role == UserRole.citizen
    user = User(
        name=payload.name,
        email=payload.email,
        password=hash_password(payload.password),
        role=payload.role,
        location=payload.location,
        is_verified=is_citizen,
        verification_status=VerificationStatus.not_required if is_citizen else VerificationStatus.pending,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Login ──────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    # Normalize email for consistent rate-limit tracking and DB lookup
    email = payload.email.strip().lower()

    # 1. Check rate limit before touching DB
    _check_rate_limit(email)

    # 2. Validate credentials (query with normalized email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password):
        _record_failed_attempt(email)
        entry = _login_attempts.get(email, (0, None))
        remaining = MAX_LOGIN_ATTEMPTS - entry[0]
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts. Account locked for {LOCKOUT_MINUTES} minute(s).",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid credentials. {remaining} attempt(s) remaining.",
        )

    # 3. Official verification check
    if user.role == UserRole.official and user.verification_status in (
        VerificationStatus.pending, VerificationStatus.rejected,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Official account verification is {user.verification_status.value}",
        )

    # 4. Clear failed attempts on success
    _clear_attempts(email)

    # 5. Issue token and register session (enforces device limit)
    token = create_access_token(user_id=user.id, role=user.role.value)
    _register_session(user.id, token)

    return TokenResponse(access_token=token)


# ── Logout ─────────────────────────────────────────────────────────────────────

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    if token in _blacklisted_tokens:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Already logged out")

    # Decode to get user_id for session cleanup
    try:
        payload = decode_access_token(token)
        _remove_session(payload["user_id"], token)
    except Exception:
        pass

    _blacklisted_tokens.add(token)
    return {"message": "Logged out successfully"}


# ── Get / Update Profile ───────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.name is not None:
        current_user.name = payload.name
    if payload.location is not None:
        current_user.location = payload.location
    db.commit()
    db.refresh(current_user)
    return current_user


# ── Email Verification ─────────────────────────────────────────────────────────

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

    user.email_verified_at   = _utcnow()
    user.is_verified         = True
    user.verification_status = VerificationStatus.verified
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


# ── Password Reset ─────────────────────────────────────────────────────────────

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

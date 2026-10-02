import os
import hashlib
import secrets
import string
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    CitizenRegister, OfficialRegister, UserLogin, UserResponse, TokenResponse,
    UserUpdate, ResendVerificationRequest, ValidateTokenResponse,
    ChangePasswordRequest, RequestPasswordChangeRequest,
)
from app.utils.security import hash_password, verify_password
from app.utils.jwt import create_access_token, decode_access_token, is_token_expired
from app.utils.cloudinary_utils import upload_base64_image
from app.utils.email import (
    send_verification_email,
    send_official_credentials_email,
    send_password_change_email,
)

load_dotenv()

EMAIL_VERIFICATION_EXPIRE_MINUTES = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_MINUTES", "30"))
PASSWORD_RESET_EXPIRE_MINUTES     = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
_bearer_scheme = HTTPBearer()

# In-memory stores
_blacklisted_tokens: set[str] = set()

# Rate limiting: email -> (failed_count, locked_until | None)
_login_attempts: dict[str, tuple[int, datetime | None]] = {}

# Active sessions: user_id -> list[token] (max 2)
_active_sessions: dict[int, list[str]] = {}

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES    = 30
MAX_SESSIONS       = 2


def _check_rate_limit(email: str) -> None:
    entry = _login_attempts.get(email)
    if not entry:
        return
    attempts, locked_until = entry
    if locked_until and _utcnow() < locked_until:
        remaining = int((locked_until - _utcnow()).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "account_locked", "message": f"Too many failed attempts. Try again in {remaining} minute(s)."},
        )
    if locked_until and _utcnow() >= locked_until:
        _login_attempts.pop(email, None)


def _record_failed(email: str) -> None:
    attempts, _ = _login_attempts.get(email, (0, None))
    attempts += 1
    locked_until = _utcnow() + timedelta(minutes=LOCKOUT_MINUTES) if attempts >= MAX_LOGIN_ATTEMPTS else None
    _login_attempts[email] = (attempts, locked_until)


def _clear_attempts(email: str) -> None:
    _login_attempts.pop(email, None)


def _register_session(user_id: int, token: str) -> None:
    sessions = [t for t in _active_sessions.get(user_id, []) if t not in _blacklisted_tokens and not is_token_expired(t)]
    if len(sessions) >= MAX_SESSIONS:
        oldest = sessions.pop(0)
        _blacklisted_tokens.add(oldest)
    sessions.append(token)
    _active_sessions[user_id] = sessions


def _remove_session(user_id: int, token: str) -> None:
    sessions = _active_sessions.get(user_id, [])
    _active_sessions[user_id] = [t for t in sessions if t != token]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _gen_token() -> str:
    return secrets.token_urlsafe(32)


def _gen_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))




def _create_password_change_token(user: User, db: Session) -> str:
    raw_token = _gen_token()
    user.password_reset_token_hash = _hash_token(raw_token)
    user.password_reset_token_expires_at = _utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
    db.commit()
    return raw_token

def _gen_dept_id(department: str) -> str:
    prefix = "".join(w[0].upper() for w in department.split()[:3])
    return f"{prefix}-{secrets.randbelow(9000) + 1000}"


# ── Auth dependency ────────────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    if token in _blacklisted_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please login again.",
        )
    try:
        payload = decode_access_token(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": str(e), "message": "Session expired. Please login again."},
        )
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_citizen(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.citizen:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Citizens only")
    return user


def require_official(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.official:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Officials only")
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "password_change_required", "message": "You must change your password before accessing the portal."},
        )
    return user


# ── Citizen Register ───────────────────────────────────────────────────────────

@router.post("/register/citizen", status_code=status.HTTP_201_CREATED)
def register_citizen(payload: CitizenRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "email_already_registered", "message": "This email is already registered."},
        )
    raw_token = _gen_token()
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password=hash_password(payload.password),
        role=UserRole.citizen,
        location=payload.location,
        email_verification_token_hash=_hash_token(raw_token),
        email_verification_token_expires_at=_utcnow() + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    send_verification_email(user.email, raw_token)
    print(f"[DEV] Citizen verification token for {user.email}: {raw_token}")
    return {"message": "Registration successful. Please check your email to verify your account."}


# ── Official Register ──────────────────────────────────────────────────────────

@router.post("/register/official", status_code=status.HTTP_201_CREATED)
def register_official(payload: OfficialRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "email_already_registered", "message": "This email is already registered."},
        )
    dept_id = _gen_dept_id(payload.department)
    raw_token = _gen_token()
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password=hash_password(_gen_token()),  # placeholder — overwritten after face verification
        role=UserRole.official,
        location=payload.location,
        department=payload.department,
        department_id=dept_id,
        email_verification_token_hash=_hash_token(raw_token),
        email_verification_token_expires_at=_utcnow() + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    send_verification_email(user.email, raw_token)
    print(f"[DEV] Official verification token for {user.email}: {raw_token}")
    return {"message": "Registration successful. Please check your email to verify your account."}


# ── Email Verification ─────────────────────────────────────────────────────────

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    token_hash = _hash_token(token)
    user = db.query(User).filter(User.email_verification_token_hash == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_token", "message": "Invalid or expired verification link."},
        )
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "token_already_used", "message": "Email already verified."},
        )
    if user.email_verification_token_expires_at and _utcnow() > user.email_verification_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired_token", "message": "Verification link has expired. Please request a new one."},
        )

    user.email_verified    = True
    user.email_verified_at = _utcnow()
    user.email_verification_token_hash = None
    user.email_verification_token_expires_at = None
    db.commit()
    return {"message": "Email verified successfully. Please complete face verification."}


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    _GENERIC = "If an unverified account exists with this email, a new verification link has been sent."
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or user.email_verified:
        return {"message": _GENERIC}
    raw_token = _gen_token()
    user.email_verification_token_hash = _hash_token(raw_token)
    user.email_verification_token_expires_at = _utcnow() + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES)
    db.commit()
    send_verification_email(user.email, raw_token)
    print(f"[DEV] Resend verification token for {user.email}: {raw_token}")
    return {"message": _GENERIC}


# ── Face Verification ──────────────────────────────────────────────────────────

@router.post("/face-verification")
def face_verification(payload: dict, db: Session = Depends(get_db)):
    """
    Accepts: {"email": str, "image": "data:image/jpeg;base64,..."}
    Email is used to identify the user (not yet logged in at this stage).
    """
    email = (payload.get("email") or "").lower().strip()
    image_data = payload.get("image") or ""

    if not email or not image_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email and image are required")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "email_not_verified", "message": "Please verify your email first."},
        )
    if user.face_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "token_already_used", "message": "Face verification already completed."},
        )

    result = upload_base64_image(image_data, folder="civix/profile_pictures")

    user.profile_picture_url      = result["url"]
    user.profile_picture_public_id = result["public_id"]
    user.face_verified             = True
    user.face_verified_at          = _utcnow()
    db.commit()

    # For officials: generate temp password and send credentials email
    if user.role == UserRole.official and not user.must_change_password:
        temp_password = _gen_temp_password()
        user.password             = hash_password(temp_password)
        user.must_change_password = True
        db.commit()
        send_official_credentials_email(
            to_email=user.email,
            name=user.name,
            temp_password=temp_password,
            department=user.department or "",
            department_id=user.department_id or "",
        )
        print(f"[DEV] Official temp password for {user.email}: {temp_password}")

    return {"message": "Face verification completed. Registration is complete."}


# ── Login ──────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    _check_rate_limit(email)

    if not user or not verify_password(payload.password, user.password):
        _record_failed(email)
        entry = _login_attempts.get(email, (0, None))
        remaining_attempts = MAX_LOGIN_ATTEMPTS - entry[0]
        if remaining_attempts <= 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "account_locked", "message": f"Account locked for {LOCKOUT_MINUTES} minutes due to too many failed attempts."},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": f"Invalid email or password. {remaining_attempts} attempt(s) remaining."},
        )

    _clear_attempts(email)

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "email_not_verified", "message": "Please verify your email before logging in."},
        )

    if not user.face_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "face_not_verified", "message": "Please complete face verification before logging in."},
        )

    token = create_access_token(user_id=user.id, role=user.role.value)
    _register_session(user.id, token)

    # If official must change password: send change-password email and block portal access
    if user.role == UserRole.official and user.must_change_password:
        raw_reset = _gen_token()
        user.password_reset_token_hash       = _hash_token(raw_reset)
        user.password_reset_token_expires_at = _utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
        user.password_reset_used_at          = None
        db.commit()
        send_password_change_email(user.email, raw_reset)
        print(f"[DEV] Password change token for {user.email}: {raw_reset}")

    return TokenResponse(access_token=token, must_change_password=user.must_change_password)


# ── Logout ─────────────────────────────────────────────────────────────────────

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
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


# ── Password Change (Official first login) ────────────────────────────────────

@router.post("/request-password-change")
def request_password_change(payload: RequestPasswordChangeRequest, db: Session = Depends(get_db)):
    _GENERIC = "If an account exists with this email, a password-change link has been sent."
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        return {"message": _GENERIC}
    raw_token = _gen_token()
    user.password_reset_token_hash       = _hash_token(raw_token)
    user.password_reset_token_expires_at = _utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
    user.password_reset_used_at          = None
    db.commit()
    send_password_change_email(user.email, raw_token)
    print(f"[DEV] Password change token for {user.email}: {raw_token}")
    return {"message": _GENERIC}


@router.post("/validate-password-token", response_model=ValidateTokenResponse)
def validate_password_token(payload: dict, db: Session = Depends(get_db)):
    raw_token = (payload.get("token") or "").strip()
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_token", "message": "Token is required."},
        )
    token_hash = _hash_token(raw_token)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_token", "message": "Invalid or expired password-change link."},
        )
    if user.password_reset_used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "token_already_used", "message": "This password-change link has already been used."},
        )
    if user.password_reset_token_expires_at and _utcnow() > user.password_reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired_token", "message": "This password-change link has expired."},
        )
    return ValidateTokenResponse(email=user.email)


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(payload.token)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_token", "message": "Invalid or expired password-change link."},
        )
    if user.password_reset_used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "token_already_used", "message": "This link has already been used."},
        )
    if user.password_reset_token_expires_at and _utcnow() > user.password_reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "expired_token", "message": "This password-change link has expired."},
        )

    user.password                    = hash_password(payload.new_password)
    user.must_change_password        = False
    user.password_reset_used_at      = _utcnow()
    user.password_reset_token_hash   = None
    user.password_reset_token_expires_at = None
    db.commit()
    return {"message": "Password changed successfully. Please login with your new password."}

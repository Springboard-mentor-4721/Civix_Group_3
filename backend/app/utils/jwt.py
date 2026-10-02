import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Any

from dotenv import load_dotenv
import jwt as pyjwt

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "civix_secret_key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


def create_access_token(
    data: Optional[dict] = None,
    *,
    user_id: Optional[int] = None,
    role: Optional[str] = None,
    email: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode: dict[str, Any] = dict(data) if data else {}

    if user_id is not None:
        to_encode["user_id"] = user_id
        to_encode["sub"] = str(user_id)
    if role is not None:
        to_encode["role"] = role
    if email is not None:
        to_encode["email"] = email

    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire

    return pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise ValueError("token_expired")
    except pyjwt.PyJWTError:
        raise ValueError("invalid_token")


def is_token_expired(token: str) -> bool:
    try:
        payload = pyjwt.decode(
            token, SECRET_KEY, algorithms=[ALGORITHM],
            options={"verify_exp": True}
        )
        exp = payload.get("exp")
        if exp is None:
            return True
        return datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc)
    except pyjwt.ExpiredSignatureError:
        return True
    except pyjwt.PyJWTError:
        return True

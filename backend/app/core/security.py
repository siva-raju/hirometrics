from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
import bcrypt
import secrets
import string

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain[:72].encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password[:72].encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_share_token(user_id: str, expires_days: int = 90) -> str:
    data = {"sub": str(user_id), "type": "share"}
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    data.update({"exp": expire})
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_invite_token(payload: dict, expires_days: int = 7) -> str:
    data = {**payload, "type": "invite"}
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    data.update({"exp": expire})
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


def generate_temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def generate_secure_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import oauth2_scheme, decode_token
from app.models.models import User, TermsVersion


def _role_value(r) -> str:
    """Extract the string value from an enum or plain string, lowercase."""
    return getattr(r, 'value', str(r)).lower().strip()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exc
    except ValueError:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise credentials_exc
    if str(user.status).upper() not in ('ACTIVE',):
        raise HTTPException(status_code=403, detail="Account is not active")
    return user


def require_roles(allowed_roles: list):
    async def _checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = str(current_user.role).lower().strip()
        allowed = [_role_value(r) for r in allowed_roles]
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Your role '{user_role}' is not in {allowed}"
            )
        return current_user
    return _checker


async def require_tc_accepted(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    result = await db.execute(select(TermsVersion).where(TermsVersion.is_current == True))
    current_tc = result.scalar_one_or_none()
    if current_tc and current_user.tc_version_id != current_tc.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Terms & Conditions have been updated. Please accept the new T&C.",
            headers={"X-TC-Update-Required": "true"}
        )
    return current_user


def validate_org_email(email: str, org_domain: str) -> bool:
    domain = email.lower().split("@")[-1] if "@" in email else ""
    return domain == org_domain.lower()

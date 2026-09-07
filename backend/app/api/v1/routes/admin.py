"""HM Admin routes — org management, ALL user management, password resets."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.models.models import User, Organization, UserRole, UserStatus
from app.core.dependencies import require_roles, get_current_user
from app.core.security import hash_password, generate_temp_password

router = APIRouter()
HM_SUPER = require_roles([UserRole.HM_SUPER_ADMIN, UserRole.HM_ADMIN])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateOrgRequest(BaseModel):
    org_name: str; org_code: str; admin_first_name: str; admin_last_name: str
    admin_email: EmailStr; industry_type: Optional[str] = None
    website_url: Optional[str] = None; formal_agreement_ref: Optional[str] = None

class UpdateOrgRequest(BaseModel):
    org_name: Optional[str] = None; industry_type: Optional[str] = None
    website_url: Optional[str] = None; formal_agreement_ref: Optional[str] = None
    status: Optional[str] = None

class CreateHMUserRequest(BaseModel):
    first_name: str; last_name: str; email: EmailStr; role: str

class ResetPasswordRequest(BaseModel):
    user_id: str

class UpdateUserStatusRequest(BaseModel):
    status: str  # active | suspended | deactivated


# ── Organization endpoints ────────────────────────────────────────────────────

@router.post("/organizations", status_code=201)
async def create_organization(data: CreateOrgRequest, current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    if (await db.execute(select(User).where(User.email == data.admin_email.lower()))).scalar_one_or_none():
        raise HTTPException(400, "Admin email already registered")
    if (await db.execute(select(Organization).where(Organization.org_code == data.org_code.upper()))).scalar_one_or_none():
        raise HTTPException(400, "Organization code already taken")
    org_domain = data.admin_email.lower().split("@")[-1]
    org = Organization(name=data.org_name, org_code=data.org_code.upper(), org_domain=org_domain,
        industry_type=data.industry_type, website_url=data.website_url,
        onboarded_by=current_user.id, formal_agreement_ref=data.formal_agreement_ref,
        onboarded_at=datetime.utcnow(), status="active")
    db.add(org); await db.flush()
    temp_pwd = generate_temp_password()
    admin = User(email=data.admin_email.lower(), email_domain=org_domain,
        first_name=data.admin_first_name, last_name=data.admin_last_name,
        hashed_password=hash_password(temp_pwd), temp_password=hash_password(temp_pwd),
        role=UserRole.CUSTOMER_ADMIN, status="active", org_id=org.id,
        must_change_password=True, tc_accepted=False)
    db.add(admin); await db.commit()
    return {"org_id": org.id, "admin_user_id": admin.id, "org_name": org.name,
            "org_domain": org_domain, "message": "Organization created.",
            "temp_password_preview": temp_pwd}

@router.get("/organizations")
async def list_organizations(current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    orgs = r.scalars().all()
    result = []
    for o in orgs:
        users_r = await db.execute(select(User).where(User.org_id == o.id))
        users = users_r.scalars().all()
        result.append({"id": o.id, "name": o.name, "org_code": o.org_code,
            "org_domain": o.org_domain, "industry_type": o.industry_type,
            "website_url": o.website_url, "formal_agreement_ref": o.formal_agreement_ref,
            "status": o.status, "created_at": o.created_at.isoformat(),
            "user_count": len(users),
            "admin_email": next((u.email for u in users if str(u.role).lower() == 'customer_admin'), None)})
    return result

@router.patch("/organizations/{org_id}")
async def update_organization(org_id: str, data: UpdateOrgRequest, current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Organization).where(Organization.id == org_id))
    org = r.scalar_one_or_none()
    if not org: raise HTTPException(404, "Organization not found")
    if data.org_name is not None: org.name = data.org_name
    if data.industry_type is not None: org.industry_type = data.industry_type
    if data.website_url is not None: org.website_url = data.website_url
    if data.formal_agreement_ref is not None: org.formal_agreement_ref = data.formal_agreement_ref
    if data.status is not None:
        if data.status.lower() not in ('active', 'suspended', 'deactivated'):
            raise HTTPException(400, "Invalid status")
        org.status = data.status.lower()
        users_r = await db.execute(select(User).where(User.org_id == org_id))
        for u in users_r.scalars().all():
            u.status = data.status.lower()
    org.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Updated", "id": org.id, "status": org.status}

@router.post("/organizations/{org_id}/reset-admin-password")
async def reset_org_admin_password(org_id: str, current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.org_id == org_id, User.role == UserRole.CUSTOMER_ADMIN))
    admin = r.scalar_one_or_none()
    if not admin: raise HTTPException(404, "No Customer Admin found")
    temp_pwd = generate_temp_password()
    admin.hashed_password = hash_password(temp_pwd); admin.temp_password = hash_password(temp_pwd)
    admin.must_change_password = True; await db.commit()
    return {"message": "Password reset", "admin_email": admin.email, "temp_password": temp_pwd}


# ── ALL Users management ──────────────────────────────────────────────────────

@router.get("/users")
async def list_all_users(
    role_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(HM_SUPER),
    db: AsyncSession = Depends(get_db)
):
    """List ALL users across the platform — HM staff, customers, and candidates."""
    query = select(User)
    if role_filter:
        query = query.where(User.role == role_filter)
    if status_filter:
        query = query.where(User.status == status_filter)
    if search:
        query = query.where(or_(
            User.email.ilike(f"%{search}%"),
            User.first_name.ilike(f"%{search}%"),
            User.last_name.ilike(f"%{search}%"),
        ))
    query = query.order_by(User.created_at.desc()).limit(200)
    r = await db.execute(query)
    users = r.scalars().all()
    result = []
    for u in users:
        org_name = None
        if u.org_id:
            org_r = await db.execute(select(Organization).where(Organization.id == u.org_id))
            org = org_r.scalar_one_or_none()
            org_name = org.name if org else None
        result.append({
            "id": u.id, "email": u.email, "first_name": u.first_name,
            "last_name": u.last_name, "role": u.role, "status": u.status,
            "org_id": u.org_id, "org_name": org_name,
            "must_change_password": u.must_change_password,
            "created_at": u.created_at.isoformat(),
        })
    return result

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalar_one_or_none()
    if not user: raise HTTPException(404, "User not found")
    temp_pwd = generate_temp_password()
    user.hashed_password = hash_password(temp_pwd); user.temp_password = hash_password(temp_pwd)
    user.must_change_password = True; await db.commit()
    return {"message": "Password reset", "email": user.email, "temp_password": temp_pwd}

@router.patch("/users/{user_id}/status")
async def update_user_status(user_id: str, data: UpdateUserStatusRequest, current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalar_one_or_none()
    if not user: raise HTTPException(404, "User not found")
    if data.status.lower() not in ('active', 'suspended', 'deactivated', 'pending'):
        raise HTTPException(400, "Invalid status")
    user.status = data.status.lower(); await db.commit()
    return {"message": "Status updated", "status": user.status}

@router.post("/reset-user-password")
async def reset_any_user_password(data: ResetPasswordRequest, current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.id == data.user_id))
    user = r.scalar_one_or_none()
    if not user: raise HTTPException(404, "User not found")
    temp_pwd = generate_temp_password()
    user.hashed_password = hash_password(temp_pwd); user.temp_password = hash_password(temp_pwd)
    user.must_change_password = True; await db.commit()
    return {"message": "Password reset", "email": user.email, "temp_password": temp_pwd}


# ── HM Users ──────────────────────────────────────────────────────────────────

@router.get("/hm-users")
async def list_hm_users(current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(
        User.role.in_(['hm_super_admin','hm_admin','hm_manager','hm_supervisor','hm_analyst','hm_qa'])
    ).order_by(User.role, User.first_name))
    return [{"id": u.id, "email": u.email, "first_name": u.first_name,
             "last_name": u.last_name, "role": u.role, "status": u.status,
             "created_at": u.created_at.isoformat()} for u in r.scalars().all()]

@router.post("/hm-users", status_code=201)
async def create_hm_user(data: CreateHMUserRequest, current_user: User = Depends(HM_SUPER), db: AsyncSession = Depends(get_db)):
    hm_roles = [r.value for r in UserRole if r.value.startswith("hm_")]
    if data.role not in hm_roles: raise HTTPException(400, f"Invalid HM role: {hm_roles}")
    from app.core.config import settings
    if not data.email.lower().endswith(f"@{settings.HM_DOMAIN}"):
        raise HTTPException(400, f"HM staff must use @{settings.HM_DOMAIN} email")
    if (await db.execute(select(User).where(User.email == data.email.lower()))).scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    temp_pwd = generate_temp_password()
    user = User(email=data.email.lower(), email_domain=settings.HM_DOMAIN,
        first_name=data.first_name, last_name=data.last_name,
        hashed_password=hash_password(temp_pwd), temp_password=hash_password(temp_pwd),
        role=data.role, status="active", must_change_password=True)
    db.add(user); await db.commit()
    return {"user_id": user.id, "message": "HM user created", "temp_password_preview": temp_pwd}

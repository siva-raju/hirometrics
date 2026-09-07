"""User settings routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.models.models import User
from app.core.dependencies import get_current_user

router = APIRouter()

class UpdateUserRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_photo_url: Optional[str] = None

@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    org_name = None
    if current_user.org_id:
        from app.models.models import Organization
        org_r = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
        org = org_r.scalar_one_or_none()
        org_name = org.name if org else None
    return {
        "id": current_user.id, "email": current_user.email,
        "first_name": current_user.first_name, "last_name": current_user.last_name,
        "role": current_user.role, "status": current_user.status,
        "org_id": current_user.org_id,
        "org_name": org_name,
        "tc_accepted": current_user.tc_accepted,
        "must_change_password": current_user.must_change_password,
        "profile_photo_url": current_user.profile_photo_url,
    }

@router.patch("/me")
async def update_me(
    data: UpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.commit()
    return {"message": "Updated"}

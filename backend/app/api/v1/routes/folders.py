"""Folder routes — CRUD, application links, archival, reassignment."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import (User, Folder, ApplicationLink, Application, UserRole, Organization)
from app.core.dependencies import get_current_user, require_roles
from app.core.security import generate_secure_token

router = APIRouter()
# HM super/admin roles are included so HM admin acts as superadmin across all orgs
EMPLOYER_ROLES = [UserRole.CUSTOMER_ADMIN, UserRole.CUSTOMER_MANAGER,
                  UserRole.HM_SUPER_ADMIN, UserRole.HM_ADMIN]
EMPLOYER_ONLY = require_roles(EMPLOYER_ROLES)
ADMIN_ONLY = require_roles([UserRole.CUSTOMER_ADMIN,
                             UserRole.HM_SUPER_ADMIN, UserRole.HM_ADMIN])

class FolderCreate(BaseModel):
    name: str                              # Position Code
    position_title: Optional[str] = None
    description: Optional[str] = None
    job_description: Optional[str] = None  # Alias for description
    # Additional Information fields
    skill_set: Optional[str] = None
    location: Optional[str] = None
    work_mode: Optional[str] = None        # Onsite / Remote / Hybrid
    duration: Optional[str] = None
    job_start_date: Optional[str] = None
    work_auth_required: Optional[str] = None
    org_id: Optional[str] = None           # HM admin can specify target org

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    position_title: Optional[str] = None
    status: Optional[str] = None

class ReassignFolder(BaseModel):
    new_owner_id: str

class ApplicationLinkCreate(BaseModel):
    label: Optional[str] = None

def folder_to_dict(f: Folder) -> dict:
    return {
        "id": f.id, "org_id": f.org_id, "owner_id": f.owner_id,
        "name": f.name,
        "position_code": f.name,  # name IS the position code
        "position_title": f.position_title,
        "description": f.description,
        "job_description": getattr(f, "job_description", f.description),
        "skill_set": getattr(f, "skill_set", None),
        "location": getattr(f, "location", None),
        "work_mode": getattr(f, "work_mode", None),
        "duration": getattr(f, "duration", None),
        "job_start_date": getattr(f, "job_start_date", None),
        "work_auth_required": getattr(f, "work_auth_required", None),
        "unique_link_token": f.unique_link_token, "status": f.status,
        "is_archived": f.is_archived,
        "archived_at": f.archived_at.isoformat() if f.archived_at else None,
        "created_at": f.created_at.isoformat(),
    }


@router.post("/", status_code=201)
async def create_folder(
    data: FolderCreate,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    folder_data = data.model_dump(exclude_none=True)
    # job_description is an alias for description
    if "job_description" in folder_data and "description" not in folder_data:
        folder_data["description"] = folder_data.pop("job_description")
    else:
        folder_data.pop("job_description", None)
    # Only pass fields that exist on the model
    model_fields = {"name","position_title","description","skill_set","location",
                    "work_mode","duration","job_start_date","work_auth_required"}
    safe_data = {k:v for k,v in folder_data.items() if k in model_fields}
    # HM admin can pass org_id explicitly; employer uses their own org
    from app.models.models import UserRole as _UR
    if current_user.role in (_UR.HM_SUPER_ADMIN, _UR.HM_ADMIN):
        effective_org_id = folder_data.get('org_id') or current_user.org_id
    else:
        effective_org_id = current_user.org_id
    safe_data.pop('org_id', None)  # remove so it doesn't conflict with explicit org_id below
    folder = Folder(
        org_id=effective_org_id,
        owner_id=current_user.id,
        created_by=current_user.id,
        unique_link_token=generate_secure_token(24),
        **safe_data
    )
    db.add(folder)
    await db.commit()
    return folder_to_dict(folder)


@router.get("/")
async def list_folders(
    current_user: User = Depends(EMPLOYER_ONLY),
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db)
):
    query = select(Folder).where(Folder.org_id == current_user.org_id)
    if current_user.role == UserRole.CUSTOMER_MANAGER:
        query = query.where(Folder.owner_id == current_user.id)
    if not include_archived:
        query = query.where(Folder.is_archived == False)
    r = await db.execute(query.order_by(Folder.created_at.desc()))
    folders = r.scalars().all()
    results = []
    for f in folders:
        d = folder_to_dict(f)
        count_r = await db.execute(select(Application).where(Application.folder_id == f.id))
        d["application_count"] = len(count_r.scalars().all())
        results.append(d)
    return results


@router.get("/{folder_id}")
async def get_folder(
    folder_id: str,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.org_id == current_user.org_id))
    folder = r.scalar_one_or_none()
    if not folder: raise HTTPException(404, "Folder not found")
    return folder_to_dict(folder)


@router.patch("/{folder_id}")
async def update_folder(
    folder_id: str, data: FolderUpdate,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.org_id == current_user.org_id))
    folder = r.scalar_one_or_none()
    if not folder: raise HTTPException(404, "Folder not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(folder, field, value)
    await db.commit()
    return folder_to_dict(folder)


@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: str,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.org_id == current_user.org_id))
    folder = r.scalar_one_or_none()
    if not folder: raise HTTPException(404, "Folder not found")
    # Only allow delete on empty folders
    apps = await db.execute(select(Application).where(Application.folder_id == folder_id))
    if apps.scalars().first():
        raise HTTPException(409, "Cannot delete a folder with applications. Archive it instead.")
    await db.delete(folder)
    await db.commit()
    return {"message": "Folder deleted"}


@router.post("/{folder_id}/archive")
async def archive_folder(
    folder_id: str,
    current_user: User = Depends(ADMIN_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.org_id == current_user.org_id))
    folder = r.scalar_one_or_none()
    if not folder: raise HTTPException(404, "Folder not found")
    folder.is_archived = True
    folder.archived_at = datetime.utcnow()
    folder.status = "archived"
    await db.commit()
    return {"message": "Folder archived"}


@router.post("/{folder_id}/restore")
async def restore_folder(
    folder_id: str,
    current_user: User = Depends(ADMIN_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.org_id == current_user.org_id))
    folder = r.scalar_one_or_none()
    if not folder: raise HTTPException(404, "Folder not found")
    folder.is_archived = False
    folder.archived_at = None
    folder.status = "open"
    await db.commit()
    return {"message": "Folder restored"}


@router.post("/{folder_id}/reassign")
async def reassign_folder(
    folder_id: str, data: ReassignFolder,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.org_id == current_user.org_id))
    folder = r.scalar_one_or_none()
    if not folder: raise HTTPException(404, "Folder not found")
    # Managers can only reassign their own folders; admins can reassign any
    if current_user.role == UserRole.CUSTOMER_MANAGER and folder.owner_id != current_user.id:
        raise HTTPException(403, "You can only reassign your own folders")
    # Verify new owner is in the same org
    new_owner_r = await db.execute(select(User).where(User.id == data.new_owner_id, User.org_id == current_user.org_id))
    new_owner = new_owner_r.scalar_one_or_none()
    if not new_owner: raise HTTPException(404, "New owner not found in your organization")
    folder.owner_id = data.new_owner_id
    await db.commit()
    return {"message": f"Folder reassigned to {new_owner.first_name} {new_owner.last_name}"}


@router.post("/{folder_id}/application-links", status_code=201)
async def create_application_link(
    folder_id: str, data: ApplicationLinkCreate,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.org_id == current_user.org_id))
    folder = r.scalar_one_or_none()
    if not folder: raise HTTPException(404, "Folder not found")
    if folder.is_archived: raise HTTPException(409, "Cannot create links for archived folders")
    link_token = generate_secure_token(24)
    link = ApplicationLink(
        folder_id=folder_id,
        token=link_token,
        label=data.label,
    )
    db.add(link)
    await db.commit()
    return {
        "id": link.id, "token": link_token,
        "apply_url": f"/apply/{link_token}",
        "label": data.label, "is_active": True,
        "created_at": link.created_at.isoformat(),
    }


@router.get("/{folder_id}/application-links")
async def list_application_links(
    folder_id: str,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicationLink).where(ApplicationLink.folder_id == folder_id))
    links = r.scalars().all()
    return [{
        "id": l.id, "token": l.token, "label": l.label,
        "is_active": l.is_active, "application_count": l.application_count,
        "apply_url": f"/apply/{l.token}",
        "created_at": l.created_at.isoformat(),
    } for l in links]

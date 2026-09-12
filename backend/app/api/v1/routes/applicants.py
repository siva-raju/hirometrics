"""Applicant profile routes — wizard steps, all credential sections."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime
import secrets

from app.db.session import get_db
from app.models.models import (User, ApplicantProfile, Address, IdentityDocument,
    WorkHistory, EmploymentReference, Education, Certification, Reference,
    Award, Resume, CorrectionRequest, UserRole, ProfileSnapshot, ShareToken, Application, Folder, ApplicationLink)
from app.core.dependencies import get_current_user, require_roles
from app.services.notification_service import notify_user

router = APIRouter()

APPLICANT_ONLY = require_roles([UserRole.APPLICANT])

# ── Profile schemas ───────────────────────────────────────────────────────────
class DemographicsUpdate(BaseModel):
    salutation: Optional[str] = None
    nick_name: Optional[str] = None
    middle_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    country_of_birth: Optional[str] = None
    primary_phone: Optional[str] = None
    secondary_phone: Optional[str] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    legal_status: Optional[str] = None
    immigration_category: Optional[str] = None
    work_auth_notes: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    linkedin_url: Optional[str] = None

class AddressCreate(BaseModel):
    address_type: str = "current"
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

class ClientEngagementCreate(BaseModel):
    client_name: str
    client_country: Optional[str] = None
    client_state: Optional[str] = None
    client_city: Optional[str] = None
    role_at_client: str
    start_date: str
    end_date: str
    engagement_type: Optional[str] = None  # on-site, remote, hybrid

class WorkHistoryCreate(BaseModel):
    employment_type: Optional[str] = None
    title: str
    employer_name: str
    employer_street: Optional[str] = None
    employer_city: Optional[str] = None
    employer_state: Optional[str] = None
    employer_country: Optional[str] = None
    area_of_industry: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    work_arrangement: Optional[str] = None  # direct / consulting
    description: Optional[str] = None
    client_engagements: Optional[list] = None
    additional_roles: Optional[list] = None
    role_history: Optional[list] = None  # list of ClientEngagementCreate dicts

class EmploymentRefCreate(BaseModel):
    referee_full_name: Optional[str] = None
    referee_designation: Optional[str] = None
    referee_email: Optional[str] = None
    referee_phone: Optional[str] = None

class EducationCreate(BaseModel):
    education_level: Optional[str] = None
    degree_name: Optional[str] = None
    specialization: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    graduation_date: Optional[str] = None
    marks_percentage: Optional[float] = None
    grade_obtained: Optional[str] = None
    institution_name: Optional[str] = None
    institution_country: Optional[str] = None
    institution_state: Optional[str] = None
    institution_city: Optional[str] = None
    institution_street: Optional[str] = None

class CertificationCreate(BaseModel):
    cert_type: Optional[str] = None
    authority_name: Optional[str] = None
    cert_name: str
    cert_number: Optional[str] = None
    cert_version: Optional[str] = None
    issued_date: Optional[str] = None
    expiry_date: Optional[str] = None
    renewal_date: Optional[str] = None
    renewal_expiry_date: Optional[str] = None
    credential_url: Optional[str] = None

class ReferenceCreate(BaseModel):
    ref_type: Optional[str] = None
    referee_first_name: str
    referee_last_name: str
    referee_title: Optional[str] = None
    referee_company: Optional[str] = None
    referee_email: str
    referee_phone: Optional[str] = None
    referee_country: Optional[str] = None
    referee_state: Optional[str] = None
    referee_city: Optional[str] = None
    relationship_type: Optional[str] = None
    relationship_description: Optional[str] = None
    is_active: Optional[bool] = True

class AwardCreate(BaseModel):
    award_type: Optional[str] = None
    award_name: str
    awarding_body: Optional[str] = None
    description: Optional[str] = None
    award_date: Optional[str] = None

class CorrectionRequestCreate(BaseModel):
    field_name: str
    section: str
    old_value: Optional[str] = None
    requested_value: str
    justification: str

# ── Helpers ───────────────────────────────────────────────────────────────────
def calc_completeness(profile: ApplicantProfile, has_work: bool, has_edu: bool,
                       has_ref: bool, has_resume: bool) -> int:
    score = 0
    if profile.primary_phone: score += 10
    if profile.legal_status:  score += 5
    if profile.headline:      score += 10
    if has_work:              score += 25
    if has_edu:               score += 20
    if has_ref:               score += 15
    if has_resume:            score += 15
    return min(score, 100)

async def update_completeness(user_id: str, db: AsyncSession):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == user_id))
    profile = r.scalar_one_or_none()
    if not profile: return
    has_work    = bool((await db.execute(select(func.count()).where(WorkHistory.profile_id == profile.id))).scalar())
    has_edu     = bool((await db.execute(select(func.count()).where(Education.profile_id == profile.id))).scalar())
    has_ref     = bool((await db.execute(select(func.count()).where(Reference.profile_id == profile.id))).scalar())
    has_resume  = bool((await db.execute(select(func.count()).where(Resume.profile_id == profile.id))).scalar())
    profile.profile_completeness = calc_completeness(profile, has_work, has_edu, has_ref, has_resume)
    await db.commit()

# ── Get full profile ──────────────────────────────────────────────────────────
@router.get("/me")
async def get_my_profile(
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    async def safe_fetch(query):
        try:
            res = await db.execute(query)
            return res.scalars().all()
        except Exception:
            return []

    async def safe_fetch_one(query):
        try:
            res = await db.execute(query)
            return res.scalar_one_or_none()
        except Exception:
            return None

    work_list = await safe_fetch(select(WorkHistory).where(WorkHistory.profile_id == profile.id))
    edu_list  = await safe_fetch(select(Education).where(Education.profile_id == profile.id))
    cert_list = await safe_fetch(select(Certification).where(Certification.profile_id == profile.id))
    ref_list  = await safe_fetch(select(Reference).where(Reference.profile_id == profile.id))
    award_list= await safe_fetch(select(Award).where(Award.profile_id == profile.id))
    addr_list = await safe_fetch(select(Address).where(Address.profile_id == profile.id))
    doc_list  = await safe_fetch(select(IdentityDocument).where(IdentityDocument.profile_id == profile.id))
    resume    = await safe_fetch_one(select(Resume).where(Resume.profile_id == profile.id, Resume.is_current == True))

    return {
        "user": {"id": current_user.id, "email": current_user.email,
                 "first_name": current_user.first_name, "last_name": current_user.last_name,
                 "role": current_user.role, "status": current_user.status,
                 "profile_photo_url": current_user.profile_photo_url},
        "profile": {
            "id": profile.id, "salutation": profile.salutation, "nick_name": profile.nick_name,
            "middle_name": profile.middle_name, "gender": profile.gender,
            "date_of_birth": profile.date_of_birth, "country_of_birth": profile.country_of_birth,
            "primary_phone": profile.primary_phone, "secondary_phone": profile.secondary_phone,
            "headline": profile.headline, "summary": profile.summary,
            "linkedin_url": profile.linkedin_url, "legal_status": profile.legal_status,
            "immigration_category": profile.immigration_category,
            "trust_score": profile.trust_score, "identity_verified": profile.identity_verified,
            "profile_completeness": profile.profile_completeness,
            "baseline_locked": profile.baseline_locked,
            "baseline_locked_at": profile.baseline_locked_at.isoformat() if profile.baseline_locked_at else None,
            "wizard_step": profile.wizard_step,
            "current_city": getattr(profile, "current_city", None),
            "current_state": getattr(profile, "current_state", None),
            "work_auth_notes": getattr(profile, "work_auth_notes", None),
            "auth_history": getattr(profile, "auth_history", None) or [],
        },
        "addresses": [{"id":a.id,"address_type":a.address_type,"street":a.street,
            "city":a.city,"state":a.state,"country":a.country}
            for a in addr_list],
        "identity_documents": [{"id":d.id,"doc_type":d.doc_type,
            "issued_country":d.issued_country,"issued_date":d.issued_date,
            "expiry_date":d.expiry_date,"verification_status":getattr(d,"verification_status","not_started")}
            for d in doc_list],
        "work_history": [{"id":w.id,"employment_type":w.employment_type,"title":w.title,
            "employer_name":w.employer_name,
            "employer_city":getattr(w,"employer_city",None),
            "employer_state":getattr(w,"employer_state",None),
            "employer_country":getattr(w,"employer_country",None),
            "area_of_industry":getattr(w,"area_of_industry",None),
            "start_date":w.start_date,"end_date":w.end_date,"is_current":w.is_current,
            "description":getattr(w,"description",None),
            "work_arrangement":getattr(w,"work_arrangement","direct"),
            "client_engagements":getattr(w,"client_engagements",[]) or [],
            "additional_roles":getattr(w,"additional_roles",[]) or [],
            "role_history":getattr(w,"role_history",[]) or [],
            "verification_status":getattr(w,"verification_status","not_started")}
            for w in work_list],
        "education": [{"id":e.id,"education_level":e.education_level,"degree_name":e.degree_name,
            "specialization":e.specialization,"start_date":e.start_date,"end_date":e.end_date,
            "graduation_date":e.graduation_date,"institution_name":e.institution_name,
            "institution_state":getattr(e,"institution_state",None),
            "institution_city":getattr(e,"institution_city",None),
            "institution_country":getattr(e,"institution_country",None),
            "verification_status":getattr(e,"verification_status","not_started")}
            for e in edu_list],
        "certifications": [{"id":c.id,"cert_type":getattr(c,"cert_type",None),
            "authority_name":c.authority_name,"cert_name":c.cert_name,
            "cert_number":c.cert_number,"issued_date":c.issued_date,
            "expiry_date":getattr(c,"expiry_date",None),
            "renewal_date":getattr(c,"renewal_date",None),
            "renewal_expiry_date":getattr(c,"renewal_expiry_date",None),
            "verification_status":getattr(c,"verification_status","not_started")}
            for c in cert_list],
        "references": [{"id":r.id,
            "referee_first_name":getattr(r,"referee_first_name",""),
            "referee_last_name":getattr(r,"referee_last_name",""),
            "referee_title":getattr(r,"referee_title",None),
            "referee_company":getattr(r,"referee_company",None),
            "referee_email":getattr(r,"referee_email",""),
            "relationship_type":getattr(r,"relationship_type",None),
            "relationship_description":getattr(r,"relationship_description",None),
            "is_active":getattr(r,"is_active",True),
            "verification_status":getattr(r,"verification_status","not_started")}
            for r in ref_list],
        "awards": [{"id":a.id,"award_type":getattr(a,"award_type",None),
            "award_name":a.award_name,"awarding_body":a.awarding_body,
            "award_date":a.award_date}
            for a in award_list],
        "current_resume": {"id":resume.id,"version_number":resume.version_number,
            "file_url":resume.file_url,"original_filename":resume.original_filename,
            "uploaded_at":resume.uploaded_at.isoformat()} if resume else None,
    }

# ── Demographics ──────────────────────────────────────────────────────────────
@router.patch("/me/demographics")
async def update_demographics(
    data: DemographicsUpdate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    if profile.wizard_step < 1: profile.wizard_step = 1
    await db.commit()
    await update_completeness(current_user.id, db)
    return {"message": "Demographics updated"}

# ── Address ───────────────────────────────────────────────────────────────────
@router.post("/me/address", status_code=201)
async def save_address(
    data: AddressCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    # Upsert current address
    existing = await db.execute(select(Address).where(
        Address.profile_id == profile.id, Address.address_type == data.address_type))
    addr = existing.scalar_one_or_none()
    if addr:
        for f, v in data.model_dump(exclude_none=True).items():
            setattr(addr, f, v)
    else:
        addr = Address(profile_id=profile.id, **data.model_dump())
        db.add(addr)
    await db.commit()
    return {"message": "Address saved", "id": addr.id}

# ── Work History ──────────────────────────────────────────────────────────────
@router.post("/me/work-history", status_code=201)
async def add_work_history(
    data: WorkHistoryCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    # Build the model dict — include work_arrangement and client_engagements (now on model)
    d = data.model_dump(exclude_none=True)
    d.pop("_open", None)
    # Store client_engagements as list (JSONB)
    client_engagements = d.pop("client_engagements", None)
    additional_roles = d.pop("additional_roles", None)
    role_history = d.pop("role_history", None)
    work_arrangement = d.pop("work_arrangement", None)
    entry = WorkHistory(profile_id=profile.id, work_arrangement=work_arrangement.lower() if work_arrangement else None, client_engagements=client_engagements, additional_roles=additional_roles, role_history=role_history, **d)
    db.add(entry)
    if profile.wizard_step < 3: profile.wizard_step = 3
    await db.commit()
    await update_completeness(current_user.id, db)
    return {"id": entry.id, "message": "Work history added"}

@router.patch("/me/work-history/{entry_id}")
async def update_work_history(
    entry_id: str, data: WorkHistoryCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(WorkHistory).where(WorkHistory.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Entry not found")
    skip = {"_open"}
    for f, v in data.model_dump(exclude_none=True).items():
        if f not in skip and hasattr(entry, f):
            # Normalize work_arrangement to lowercase
            if f == "work_arrangement" and v:
                v = v.lower()
            setattr(entry, f, v)
    from sqlalchemy.orm.attributes import flag_modified
    if data.client_engagements is not None: flag_modified(entry, "client_engagements")
    if data.additional_roles is not None: flag_modified(entry, "additional_roles")
    if data.role_history is not None: flag_modified(entry, "role_history")
    await db.commit()
    return {"message": "Updated"}

@router.delete("/me/work-history/{entry_id}")
async def delete_work_history(
    entry_id: str,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(WorkHistory).where(WorkHistory.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Not found")
    await db.delete(entry)
    await db.commit()
    await update_completeness(current_user.id, db)
    return {"message": "Deleted"}

# ── Client Engagements (append to JSONB column) ──────────────────────────────
@router.patch("/me/work-history/{entry_id}/client-engagements", status_code=200)
async def add_client_engagement(
    entry_id: str,
    data: dict,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """Append one client engagement to the work history JSONB list."""
    r = await db.execute(select(WorkHistory).where(WorkHistory.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Work history entry not found")
    existing = list(entry.client_engagements or [])
    existing.append(data)
    entry.client_engagements = existing
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(entry, "client_engagements")
    await db.commit()
    return {"message": "Client engagement added", "total": len(existing)}

# ── Employment Reference ──────────────────────────────────────────────────────
@router.post("/me/work-history/{work_id}/reference", status_code=201)
async def add_employment_reference(
    work_id: str, data: EmploymentRefCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    ref = EmploymentReference(work_history_id=work_id, **data.model_dump())
    db.add(ref)
    await db.commit()
    return {"id": ref.id, "message": "Reference added"}

# ── Education ─────────────────────────────────────────────────────────────────

@router.post("/me/auth-history")
async def add_auth_history(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save auth history entry and update current auth fields without freezing."""
    profile = await db.scalar(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    if not profile:
        raise HTTPException(404, "Profile not found")
    from sqlalchemy.orm.attributes import flag_modified
    history = list(profile.auth_history or [])
    history.append(payload.get("history_entry", {}))
    profile.auth_history = history
    flag_modified(profile, "auth_history")
    if "legal_status" in payload:         profile.legal_status = payload["legal_status"]
    if "immigration_category" in payload: profile.immigration_category = payload["immigration_category"]
    if "work_auth_notes" in payload:      profile.work_auth_notes = payload["work_auth_notes"]
    await db.commit()
    return {"message": "Auth history updated"}

@router.post("/me/education", status_code=201)
async def add_education(
    data: EducationCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    entry = Education(profile_id=profile.id, **data.model_dump())
    db.add(entry)
    if profile.wizard_step < 2: profile.wizard_step = 2
    await db.commit()
    await update_completeness(current_user.id, db)
    return {"id": entry.id, "message": "Education added"}

@router.patch("/me/education/{entry_id}")
async def update_education(
    entry_id: str, data: EducationCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Education).where(Education.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Not found")
    for f, v in data.model_dump(exclude_none=True).items():
        if hasattr(entry, f):
            setattr(entry, f, v)
    await db.commit()
    return {"message": "Updated"}

@router.delete("/me/education/{entry_id}")
async def delete_education(
    entry_id: str,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Education).where(Education.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Not found")
    await db.delete(entry)
    await db.commit()
    await update_completeness(current_user.id, db)
    return {"message": "Deleted"}

# ── Certifications ────────────────────────────────────────────────────────────
@router.post("/me/certifications", status_code=201)
async def add_certification(
    data: CertificationCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    entry = Certification(profile_id=profile.id, **data.model_dump())
    db.add(entry)
    if profile.wizard_step < 5: profile.wizard_step = 5
    await db.commit()
    return {"id": entry.id, "message": "Certification added"}

@router.patch("/me/certifications/{entry_id}")
async def update_certification(
    entry_id: str, data: CertificationCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Certification).where(Certification.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Not found")
    for f, v in data.model_dump(exclude_none=True).items():
        setattr(entry, f, v)
    await db.commit()
    return {"message": "Updated"}

@router.delete("/me/certifications/{entry_id}")
async def delete_certification(
    entry_id: str,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Certification).where(Certification.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Not found")
    await db.delete(entry)
    await db.commit()
    return {"message": "Deleted"}

# ── References ────────────────────────────────────────────────────────────────
@router.post("/me/references", status_code=201)
async def add_reference(
    data: ReferenceCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    entry = Reference(
        profile_id=profile.id,
        verification_token=secrets.token_urlsafe(32),
        **data.model_dump()
    )
    db.add(entry)
    if profile.wizard_step < 4: profile.wizard_step = 4
    await db.commit()
    await update_completeness(current_user.id, db)
    # TODO: send verification email to referee
    return {"id": entry.id, "message": "Reference added — verification email sent to referee"}

@router.delete("/me/references/{entry_id}")
async def delete_reference(
    entry_id: str,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Reference).where(Reference.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Not found")
    await db.delete(entry)
    await db.commit()
    await update_completeness(current_user.id, db)
    return {"message": "Deleted"}

@router.patch("/me/references/{entry_id}")
async def update_reference(
    entry_id: str, data: ReferenceCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Reference).where(Reference.id == entry_id))
    entry = r.scalar_one_or_none()
    if not entry: raise HTTPException(404, "Not found")
    for f, v in data.model_dump(exclude_none=True).items():
        setattr(entry, f, v)
    await db.commit()
    return {"message": "Updated"}

# ── Awards ────────────────────────────────────────────────────────────────────
@router.post("/me/awards", status_code=201)
async def add_award(
    data: AwardCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    entry = Award(profile_id=profile.id, **data.model_dump())
    db.add(entry)
    await db.commit()
    return {"id": entry.id, "message": "Award added"}

# ── Correction requests ───────────────────────────────────────────────────────
@router.post("/me/correction-requests", status_code=201)
async def request_correction(
    data: CorrectionRequestCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    req = CorrectionRequest(profile_id=profile.id, requested_by=current_user.id, **data.model_dump())
    db.add(req)
    await db.commit()
    return {"id": req.id, "message": "Correction request submitted"}

@router.get("/me/correction-requests")
async def list_correction_requests(
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: return []
    reqs = await db.execute(select(CorrectionRequest).where(CorrectionRequest.profile_id == profile.id))
    return [{"id":r.id,"field_name":r.field_name,"section":r.section,
             "requested_value":r.requested_value,"status":r.status,
             "created_at":r.created_at.isoformat()} for r in reqs.scalars().all()]

# ── Resume upload ─────────────────────────────────────────────────────────────
import os, uuid as _uuid
from datetime import datetime as _dt

RESUME_DIR = "/app/resumes"

@router.post("/me/resume", status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """Upload a new resume version. Optionally include a description for version tracking."""
    if not file.filename.lower().endswith(('.pdf', '.doc', '.docx')):
        raise HTTPException(400, "Only PDF, DOC, DOCX files are accepted")
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(400, "File must be under 10MB")

    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    os.makedirs(RESUME_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    content = await file.read()

    # Find existing active resume (is_current=True)
    active_r = await db.execute(
        select(Resume).where(Resume.profile_id == profile.id, Resume.is_current == True)
    )
    active = active_r.scalar_one_or_none()

    if active:
        # Overwrite the active row in-place — replace file, update metadata
        old_path = f"/app{active.file_url}"
        if os.path.exists(old_path):
            os.remove(old_path)
        stored_name = f"{profile.id}_v{active.version_number}{ext}"
        stored_path = os.path.join(RESUME_DIR, stored_name)
        with open(stored_path, "wb") as f:
            f.write(content)
        active.original_filename = file.filename
        active.file_url = f"/resumes/{stored_name}"
        active.file_size_bytes = len(content)
        active.description = (description or "").strip()[:120] or None
        active.uploaded_at = _dt.utcnow()
        await db.commit()
        await update_completeness(current_user.id, db)
        return {
            "id": active.id,
            "version_number": active.version_number,
            "original_filename": file.filename,
            "uploaded_at": active.uploaded_at.isoformat(),
            "message": "Active resume updated successfully",
        }
    else:
        # No active resume — create a new row with next version number
        all_r = await db.execute(select(Resume).where(Resume.profile_id == profile.id))
        all_resumes = all_r.scalars().all()
        version = max((rv.version_number for rv in all_resumes), default=0) + 1
        stored_name = f"{profile.id}_v{version}{ext}"
        stored_path = os.path.join(RESUME_DIR, stored_name)
        with open(stored_path, "wb") as f:
            f.write(content)
        resume = Resume(
            profile_id=profile.id,
            original_filename=file.filename,
            file_url=f"/resumes/{stored_name}",
            file_size_bytes=len(content),
            version_number=version,
            is_current=True,
            description=(description or "").strip()[:120] or None,
            uploaded_at=_dt.utcnow(),
        )
        db.add(resume)
        await db.commit()
        await update_completeness(current_user.id, db)
        return {
            "id": resume.id,
            "version_number": version,
            "original_filename": file.filename,
            "uploaded_at": resume.uploaded_at.isoformat(),
            "message": "Resume uploaded successfully",
        }


# ── Resume list + activate ────────────────────────────────────────────────────

@router.get("/me/resumes")
async def get_my_resumes(
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """All resume versions for this candidate, newest first."""
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile:
        return []
    res_r = await db.execute(
        select(Resume).where(Resume.profile_id == profile.id)
        .order_by(Resume.version_number.desc())
    )
    resumes = res_r.scalars().all()
    return [
        {
            "id": r.id,
            "version_number": r.version_number,
            "original_filename": r.original_filename,
            "description": r.description,
            "is_current": r.is_current,
            "is_submitted": not r.is_current,
            "file_size_bytes": r.file_size_bytes,
            "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
        }
        for r in resumes
    ]


@router.patch("/me/resume/activate/{resume_id}")
async def activate_resume(
    resume_id: str,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """Set a previously uploaded resume as the active (current) version."""
    prof_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = prof_r.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    # Verify the resume belongs to this candidate
    target_r = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.profile_id == profile.id)
    )
    target = target_r.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Resume not found")

    # Deactivate all, activate target
    all_r = await db.execute(select(Resume).where(Resume.profile_id == profile.id))
    for res in all_r.scalars().all():
        res.is_current = (res.id == resume_id)

    await db.commit()
    return {"message": f"Version {target.version_number} set as active resume"}



# ── Resume file download (by resume ID) ──────────────────────────────────────

@router.get("/me/resume-file/{resume_id}")
async def download_resume_by_id(
    resume_id: str,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """Download a specific resume version by UUID."""
    from fastapi.responses import FileResponse
    prof_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = prof_r.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    res_r = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.profile_id == profile.id))
    resume = res_r.scalar_one_or_none()
    if not resume:
        raise HTTPException(404, "Resume not found")
    import os as _os
    file_path = f"/app{resume.file_url}"
    if not _os.path.exists(file_path):
        raise HTTPException(404, "Resume file not found on server")
    return FileResponse(
        path=file_path,
        filename=resume.original_filename or f"resume_v{resume.version_number}.pdf",
        media_type="application/octet-stream",
    )



# ── Wizard step tracking ───────────────────────────────────────────────────────
class WizardStepUpdate(BaseModel):
    step: int

@router.patch("/me/wizard-step")
async def update_wizard_step(
    data: WizardStepUpdate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    if data.step > profile.wizard_step:
        profile.wizard_step = data.step
    await db.commit()
    return {"wizard_step": profile.wizard_step}


# ── Profile park / submit ─────────────────────────────────────────────────────
class ProfileAction(BaseModel):
    action: str   # "park" or "submit"
    wizard_step: Optional[int] = None

@router.post("/me/profile-action")
async def profile_action(
    data: ProfileAction,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")

    # Always save the current step if provided
    if data.wizard_step is not None and data.wizard_step >= profile.wizard_step:
        profile.wizard_step = data.wizard_step

    if data.action == "submit":
        # Check resume exists
        resume_r = await db.execute(select(Resume).where(Resume.profile_id == profile.id, Resume.is_current == True))
        if not resume_r.scalar_one_or_none():
            raise HTTPException(400, "A resume must be uploaded before submitting your profile")
        profile.baseline_locked = True
        profile.baseline_locked_at = _dt.utcnow()
        profile.wizard_step = 5  # mark as fully completed
        await db.commit()
        return {"message": "Profile submitted and locked", "baseline_locked": True}
    elif data.action == "park":
        await db.commit()
        return {"message": "Profile saved. You can continue editing any time.", "baseline_locked": False}
    else:
        raise HTTPException(400, "Invalid action. Use 'park' or 'submit'")


# ── HM Admin: unlock a submitted profile ─────────────────────────────────────
from app.core.dependencies import require_roles as _require_roles
HM_ADMIN_ROLES = _require_roles(["hm_super_admin", "hm_admin", "hm_manager"])

class UnlockProfileRequest(BaseModel):
    user_id: str
    reason: str

@router.post("/admin/unlock-profile")
async def admin_unlock_profile(
    data: UnlockProfileRequest,
    current_user: User = Depends(HM_ADMIN_ROLES),
    db: AsyncSession = Depends(get_db)
):
    """HM Admin unlocks a candidate's submitted/locked profile for editing."""
    # Find profile by user_id
    r = await db.execute(select(ApplicantProfile).where(
        ApplicantProfile.user_id == data.user_id
    ))
    profile = r.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")
    if not profile.baseline_locked:
        return {"message": "Profile is already unlocked", "baseline_locked": False}
    profile.baseline_locked = False
    profile.baseline_locked_at = None
    await db.commit()
    # Notify the candidate
    await notify_user(
        db=db,
        user_id=data.user_id,
        title="Your profile has been unlocked",
        body=f"HiroMetrics has unlocked your profile for editing. Reason: {data.reason}. "
             f"Please update your profile and re-submit when ready.",
        notification_type="action_required",
        trigger_event=f"admin_unlock:{profile.id}",
    )
    await db.commit()
    return {"message": "Profile unlocked successfully", "baseline_locked": False}


# ── Public: apply via Job Link (candidate submits to a job folder) ────────────
class ApplyViaLinkRequest(BaseModel):
    candidate_id: str   # candidate's user ID
    message: Optional[str] = None

@router.post("/apply/{link_token}")
async def apply_via_job_link(
    link_token: str,
    data: ApplyViaLinkRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Flow C — Candidate submits application via a job link token.
    No auth required — candidate provides their user ID.
    Profile must be submitted (baseline_locked) to apply.
    Resume must exist.
    """
    from app.models.models import ApplicationLink, Folder, Application, Organization

    # Find the application link
    link_r = await db.execute(select(ApplicationLink).where(
        ApplicationLink.token == link_token,
        (ApplicationLink.is_active == True) | (ApplicationLink.is_active == None)
    ))
    link = link_r.scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Invalid or expired job link")

    # Verify candidate exists
    cand_r = await db.execute(select(User).where(
        User.id == data.candidate_id, User.role == "applicant", User.status == "active"
    ))
    candidate = cand_r.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    # Check profile is submitted
    prof_r = await db.execute(select(ApplicantProfile).where(
        ApplicantProfile.user_id == data.candidate_id
    ))
    profile = prof_r.scalar_one_or_none()
    if not profile:
        raise HTTPException(400, "Profile not found")
    if not profile.baseline_locked:
        raise HTTPException(400, "Your profile must be submitted and locked before applying. Please complete and submit your profile first.")

    # Check resume exists
    res_r = await db.execute(select(Resume).where(
        Resume.profile_id == profile.id, Resume.is_current == True
    ))
    if not res_r.scalar_one_or_none():
        raise HTTPException(400, "A resume must be uploaded before applying")

    # Check for duplicate application
    dup_r = await db.execute(select(Application).where(
        Application.folder_id == link.folder_id,
        Application.candidate_id == data.candidate_id
    ))
    if dup_r.scalar_one_or_none():
        raise HTTPException(409, "You have already applied to this position")

    # Create application — freeze profile into snapshot + share token
    folder_r = await db.execute(select(Folder).where(Folder.id == link.folder_id))
    folder = folder_r.scalar_one_or_none()

    from app.models.models import ProfileSnapshot, ShareToken as ShareTokenModel
    from app.api.v1.routes.share import build_snapshot_data
    import secrets as _secrets
    count_r = await db.execute(select(ProfileSnapshot).where(ProfileSnapshot.profile_id == profile.id))
    version = len(count_r.scalars().all()) + 1
    snapshot_data = await build_snapshot_data(profile.id, db)
    snapshot = ProfileSnapshot(
        profile_id=profile.id,
        profile_version=version,
        snapshot_data=snapshot_data,
        triggered_by="job_link",
    )
    db.add(snapshot)
    await db.flush()

    share_token = ShareTokenModel(
        user_id=data.candidate_id,
        profile_snapshot_id=snapshot.id,
        token=_secrets.token_urlsafe(48),
        is_active=True,
    )
    db.add(share_token)
    await db.flush()

    application = Application(
        folder_id=link.folder_id,
        candidate_id=data.candidate_id,
        share_token_id=share_token.id,
        submitted_by_org_id=folder.org_id if folder else None,
        submitted_by_user_id=data.candidate_id,
        flow_type="job_link",
        status="received",
        chain_depth=0,
        cover_message=data.message,
    )
    db.add(application)
    link.application_count = (link.application_count or 0) + 1
    await db.flush()

    # Queue for HM Admin review
    from app.models.models import SubmissionReview
    review = SubmissionReview(
        application_id=application.id,
        candidate_id=data.candidate_id,
        folder_id=link.folder_id,
        status="awaiting_review",
        archived=False,
    )
    db.add(review)
    await db.flush()
    await db.commit()

    # Notify employer org users
    if folder:
        org_users_r = await db.execute(select(User).where(
            User.org_id == folder.org_id,
            User.role.in_(["customer_admin", "customer_manager"])
        ))
        for emp in org_users_r.scalars().all():
            await notify_user(
                db=db,
                user_id=emp.id,
                title=f"New application: {folder.name}",
                body=f"{candidate.first_name} {candidate.last_name} has applied to {folder.name}.",
                notification_type="action_required",
                trigger_event=f"application:{application.id}",
            )
    await db.commit()

    return {
        "message": "Application submitted successfully",
        "application_id": application.id,
        "folder_name": folder.name if folder else None,
    }


# ── Profile photo upload ──────────────────────────────────────────────────────
PHOTO_DIR = "/app/photos"

@router.post("/me/photo", status_code=201)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """Upload candidate identity photo. Stays editable even after profile lock."""
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"Accepted formats: JPG, JPEG, PNG, WEBP, HEIC, BMP")
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(400, "Photo must be under 5MB")

    os.makedirs(PHOTO_DIR, exist_ok=True)
    stored_name = f"{current_user.id}_photo{ext}"
    stored_path = os.path.join(PHOTO_DIR, stored_name)
    content_data = await file.read()
    with open(stored_path, "wb") as f:
        f.write(content_data)

    # Update user profile_photo_url
    user_r = await db.execute(select(User).where(User.id == current_user.id))
    user = user_r.scalar_one_or_none()
    user.profile_photo_url = f"/api/v1/applicants/me/photo/{stored_name}"
    await db.commit()

    return {"photo_url": user.profile_photo_url, "message": "Identity photo uploaded"}


@router.get("/me/photo/{filename}")
async def get_profile_photo(filename: str, db: AsyncSession = Depends(get_db)):
    """Serve profile photo — public so it can be displayed in the sidebar."""
    from fastapi.responses import FileResponse as FR
    file_path = os.path.join("/app/photos", filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "Photo not found")
    ext = os.path.splitext(filename)[1].lower()
    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                   ".png": "image/png", ".webp": "image/webp", ".bmp": "image/bmp"}
    return FR(path=file_path, media_type=media_types.get(ext, "image/jpeg"))

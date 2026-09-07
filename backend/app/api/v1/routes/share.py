"""Share token routes — generate, view public profile, QR, deactivate."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import (User, ApplicantProfile, ProfileSnapshot,
    ShareToken, WorkHistory, Education, Certification, Reference, Award, Resume,
    Address, IdentityDocument, UserRole)
from app.core.dependencies import get_current_user, require_roles
from app.core.security import create_share_token, generate_secure_token

router = APIRouter()
APPLICANT_ONLY = require_roles([UserRole.APPLICANT])

class GenerateShareTokenRequest(BaseModel):
    label: Optional[str] = None
    expires_days: int = 90  # 90=3mo, 180=6mo, 270=9mo

async def build_snapshot_data(profile_id: str, db: AsyncSession) -> dict:
    """Serialize full profile to JSONB — frozen at time of call."""
    p_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.id == profile_id))
    profile = p_r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    u_r = await db.execute(select(User).where(User.id == profile.user_id))
    user = u_r.scalar_one_or_none()
    work_r = await db.execute(select(WorkHistory).where(WorkHistory.profile_id == profile_id))
    edu_r  = await db.execute(select(Education).where(Education.profile_id == profile_id))
    cert_r = await db.execute(select(Certification).where(Certification.profile_id == profile_id))
    ref_r  = await db.execute(select(Reference).where(Reference.profile_id == profile_id))
    awd_r  = await db.execute(select(Award).where(Award.profile_id == profile_id))
    addr_r = await db.execute(select(Address).where(Address.profile_id == profile_id))
    doc_r  = await db.execute(select(IdentityDocument).where(IdentityDocument.profile_id == profile_id))
    res_r  = await db.execute(select(Resume).where(Resume.profile_id == profile_id, Resume.is_current == True))

    return {
        "user": {"email": user.email if user else "", "first_name": user.first_name if user else "",
                 "last_name": user.last_name if user else ""},
        "profile": {"salutation": profile.salutation, "nick_name": profile.nick_name,
            "middle_name": profile.middle_name, "gender": profile.gender,
            "date_of_birth": profile.date_of_birth, "country_of_birth": profile.country_of_birth,
            "primary_phone": profile.primary_phone, "secondary_phone": profile.secondary_phone,
            "headline": profile.headline, "summary": profile.summary,
            "linkedin_url": profile.linkedin_url, "legal_status": profile.legal_status,
            "identity_verified": profile.identity_verified,
            "profile_completeness": profile.profile_completeness},
        "addresses": [{"address_type":a.address_type,"street":a.street,"city":a.city,
            "state":a.state,"country":a.country} for a in addr_r.scalars().all()],
        "identity_documents": [{"doc_type":d.doc_type,"issued_country":d.issued_country,
            "issued_state":d.issued_state,"issued_date":d.issued_date,
            "expiry_date":d.expiry_date,"verification_status":d.verification_status}
            for d in doc_r.scalars().all()],
        "work_history": [{"employment_type":w.employment_type,"title":w.title,
            "employer_name":w.employer_name,"employer_city":w.employer_city,
            "employer_state":w.employer_state,"employer_country":w.employer_country,
            "start_date":w.start_date,"end_date":w.end_date,"is_current":w.is_current,
            "verification_status":w.verification_status} for w in work_r.scalars().all()],
        "education": [{"education_level":e.education_level,"degree_name":e.degree_name,
            "specialization":e.specialization,"institution_name":e.institution_name,
            "institution_country":e.institution_country,"start_date":e.start_date,
            "end_date":e.end_date,"graduation_date":e.graduation_date,
            "verification_status":e.verification_status} for e in edu_r.scalars().all()],
        "certifications": [{"cert_type":c.cert_type,"authority_name":c.authority_name,
            "cert_name":c.cert_name,"cert_number":c.cert_number,"issued_date":c.issued_date,
            "expiry_date":c.expiry_date,"verification_status":c.verification_status}
            for c in cert_r.scalars().all()],
        "references": [{"ref_type":r.ref_type,"referee_first_name":r.referee_first_name,
            "referee_last_name":r.referee_last_name,"referee_title":r.referee_title,
            "referee_company":r.referee_company,"relationship_type":r.relationship_type,
            "verification_status":r.verification_status} for r in ref_r.scalars().all()],
        "awards": [{"award_type":a.award_type,"award_name":a.award_name,
            "awarding_body":a.awarding_body,"award_date":a.award_date} for a in awd_r.scalars().all()],
        "resume": (lambda res: {"original_filename": res.original_filename,
            "uploaded_at": res.uploaded_at.isoformat(), "version_number": res.version_number}
            if res else None)(res_r.scalar_one_or_none()),
    }


@router.post("/generate", status_code=201)
async def generate_share_link(
    data: GenerateShareTokenRequest,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    # Get profile
    r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")
    if not profile.baseline_locked:
        # Lock baseline on first share
        profile.baseline_locked = True
        profile.baseline_locked_at = datetime.utcnow()

    # Count existing versions for this profile
    count_r = await db.execute(select(ProfileSnapshot).where(ProfileSnapshot.profile_id == profile.id))
    version = len(count_r.scalars().all()) + 1

    # Create frozen snapshot
    snapshot_data = await build_snapshot_data(profile.id, db)
    snapshot = ProfileSnapshot(
        profile_id=profile.id,
        profile_version=version,
        snapshot_data=snapshot_data,
        triggered_by="candidate_share"
    )
    db.add(snapshot)
    await db.flush()

    # Create share token
    expires_at = datetime.utcnow() + timedelta(days=data.expires_days)
    token_str = generate_secure_token(48)
    share_token = ShareToken(
        user_id=current_user.id,
        profile_snapshot_id=snapshot.id,
        token=token_str,
        label=data.label,
        is_active=True,
        expires_at=expires_at,
    )
    db.add(share_token)
    await db.commit()

    return {
        "id": share_token.id,
        "token": token_str,
        "share_url": f"/verified/{token_str}",
        "label": data.label,
        "expires_at": expires_at.isoformat(),
        "created_at": share_token.created_at.isoformat(),
    }


@router.get("/my-links")
async def list_my_share_links(
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ShareToken).where(ShareToken.user_id == current_user.id).order_by(ShareToken.created_at.desc()))
    tokens = r.scalars().all()
    return [{
        "id": t.id, "token": t.token, "label": t.label,
        "is_active": t.is_active, "view_count": t.view_count,
        "expires_at": t.expires_at.isoformat() if t.expires_at else None,
        "last_viewed_at": t.last_viewed_at.isoformat() if t.last_viewed_at else None,
        "created_at": t.created_at.isoformat(),
        "share_url": f"/verified/{t.token}",
    } for t in tokens]


@router.patch("/deactivate/{token_id}")
async def deactivate_share_link(
    token_id: str,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(ShareToken).where(ShareToken.id == token_id, ShareToken.user_id == current_user.id))
    token = r.scalar_one_or_none()
    if not token: raise HTTPException(404, "Share link not found")
    token.is_active = False
    await db.commit()
    return {"message": "Share link deactivated"}


@router.get("/public/{token}")
async def view_public_profile(token: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — no auth required. Returns frozen snapshot."""
    r = await db.execute(select(ShareToken).where(ShareToken.token == token))
    share_token = r.scalar_one_or_none()
    if not share_token:
        raise HTTPException(404, "Profile link not found or expired")
    if not share_token.is_active:
        raise HTTPException(410, "This share link has been deactivated")
    if share_token.expires_at and share_token.expires_at < datetime.utcnow():
        raise HTTPException(410, "This share link has expired")

    # Update analytics
    share_token.view_count += 1
    share_token.last_viewed_at = datetime.utcnow()

    # Fetch frozen snapshot
    snap_r = await db.execute(select(ProfileSnapshot).where(ProfileSnapshot.id == share_token.profile_snapshot_id))
    snapshot = snap_r.scalar_one_or_none()
    await db.commit()

    return {
        "snapshot": snapshot.snapshot_data,
        "snapshotted_at": snapshot.snapshotted_at.isoformat(),
        "view_count": share_token.view_count,
        "expires_at": share_token.expires_at.isoformat() if share_token.expires_at else None,
    }

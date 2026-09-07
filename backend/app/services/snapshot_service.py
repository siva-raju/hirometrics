"""
Snapshot service — serializes a candidate's complete profile
into a frozen JSONB record used by share tokens.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import (
    ApplicantProfile, ProfileSnapshot, Resume,
    WorkHistory, Education, Certification, Reference,
    Award, Address, IdentityDocument
)


async def create_snapshot(
    db: AsyncSession,
    profile: ApplicantProfile,
    triggered_by: str = "share_link",
) -> ProfileSnapshot:
    """Create a frozen JSONB snapshot of the candidate profile."""

    # Determine next version number
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(ProfileSnapshot.id)).where(
            ProfileSnapshot.profile_id == profile.id
        )
    )
    count = result.scalar() or 0
    version = count + 1

    # Serialize the full profile
    data = _serialize_profile(profile)

    snapshot = ProfileSnapshot(
        profile_id=profile.id,
        profile_version=version,
        snapshot_data=data,
        triggered_by=triggered_by,
    )
    db.add(snapshot)
    await db.flush()
    return snapshot


def _serialize_profile(profile: ApplicantProfile) -> dict:
    """Convert profile and all relations to a JSON-safe dict."""
    user = profile.user

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "middle_name": user.middle_name,
            "last_name": user.last_name,
            "nick_name": user.nick_name,
            "profile_photo_url": user.profile_photo_url,
        },
        "profile": {
            "id": str(profile.id),
            "salutation": profile.salutation,
            "gender": profile.gender,
            "date_of_birth": profile.date_of_birth.isoformat() if profile.date_of_birth else None,
            "country_of_birth": profile.country_of_birth,
            "primary_phone": profile.primary_phone,
            "secondary_phone": profile.secondary_phone,
            "headline": profile.headline,
            "summary": profile.summary,
            "linkedin_url": profile.linkedin_url,
            "legal_status": profile.legal_status,
            "immigration_category": profile.immigration_category,
            "identity_verified": profile.identity_verified,
            "trust_score": profile.trust_score,
            "profile_completeness": profile.profile_completeness,
            "baseline_locked": profile.baseline_locked,
        },
        "addresses": [
            {
                "address_type": a.address_type,
                "street": a.street,
                "city": a.city,
                "state": a.state,
                "country": a.country,
            }
            for a in (profile.addresses or [])
        ],
        "identity_documents": [
            {
                "doc_type": d.doc_type,
                "doc_number": d.doc_number,
                "issued_country": d.issued_country,
                "issued_state": d.issued_state,
                "issued_date": d.issued_date.isoformat() if d.issued_date else None,
                "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
                "visa_type": d.visa_type,
                "verification_status": d.verification_status,
            }
            for d in (profile.identity_documents or [])
        ],
        "work_history": [
            {
                "id": str(w.id),
                "employment_type": w.employment_type,
                "title": w.title,
                "employer_name": w.employer_name,
                "employer_city": w.employer_city,
                "employer_state": w.employer_state,
                "employer_country": w.employer_country,
                "area_of_industry": w.area_of_industry,
                "start_date": w.start_date,
                "end_date": w.end_date,
                "is_current": w.is_current,
                "description": w.description,
                "verification_status": w.verification_status,
                "employment_references": [
                    {
                        "full_name": r.full_name,
                        "designation": r.designation,
                        "email": r.email,
                        "verification_status": r.verification_status,
                    }
                    for r in (w.employment_references or [])
                ],
            }
            for w in (profile.work_history or [])
        ],
        "education": [
            {
                "id": str(e.id),
                "education_level": e.education_level,
                "degree_name": e.degree_name,
                "specialization": e.specialization,
                "institution_name": e.institution_name,
                "institution_country": e.institution_country,
                "institution_city": e.institution_city,
                "start_date": e.start_date,
                "end_date": e.end_date,
                "graduation_date": e.graduation_date,
                "marks_percentage": e.marks_percentage,
                "grade_obtained": e.grade_obtained,
                "verification_status": e.verification_status,
            }
            for e in (profile.education or [])
        ],
        "certifications": [
            {
                "id": str(c.id),
                "cert_type": c.cert_type,
                "cert_name": c.cert_name,
                "authority_name": c.authority_name,
                "cert_number": c.cert_number,
                "issued_date": c.issued_date.isoformat() if c.issued_date else None,
                "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
                "credential_url": c.credential_url,
                "verification_status": c.verification_status,
            }
            for c in (profile.certifications or [])
        ],
        "references": [
            {
                "id": str(r.id),
                "ref_type": r.ref_type,
                "referee_name": r.referee_name,
                "referee_title": r.referee_title,
                "referee_company": r.referee_company,
                "referee_email": r.referee_email,
                "relationship_type": r.relationship_type,
                "verification_status": r.verification_status,
            }
            for r in (profile.references or [])
        ],
        "awards": [
            {
                "id": str(a.id),
                "award_type": a.award_type,
                "award_name": a.award_name,
                "awarding_body": a.awarding_body,
                "award_date": a.award_date.isoformat() if a.award_date else None,
                "verification_status": a.verification_status,
            }
            for a in (profile.awards or [])
        ],
        "resume": next(
            (
                {
                    "version_number": r.version_number,
                    "file_url": r.file_url,
                    "original_filename": r.original_filename,
                    "uploaded_at": r.uploaded_at.isoformat(),
                }
                for r in sorted(profile.resumes or [], key=lambda x: x.version_number, reverse=True)
                if r.is_current
            ),
            None,
        ),
    }

"""Invitation routes — Flow B invite-to-apply + enrollment invitations."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.session import get_db
from app.models.models import (User, Invitation, EnrollmentInvitation,
    Application, ApplicantProfile, ShareToken, ProfileSnapshot, UserRole, Organization,
    Folder, CandidateJobLink, ApplicationLink, Resume, SubmissionReview)
from app.core.dependencies import get_current_user, require_roles
from app.core.security import generate_secure_token
from app.api.v1.routes.share import build_snapshot_data
from app.utils.email_templates import email_invitation_to_apply, email_enrollment_invitation
from app.core.config import settings

def _strip_linked_from(text: str | None) -> str | None:
    """Remove the [Linked from: ...] prefix from folder descriptions before sending to candidates."""
    if not text:
        return text
    import re as _re
    cleaned = _re.sub(r'^\[Linked from:[^\]]*\]', '', text)
    return cleaned.strip('\n').strip() or None



router = APIRouter()
EMPLOYER_ONLY = require_roles([UserRole.CUSTOMER_ADMIN, UserRole.CUSTOMER_MANAGER])
APPLICANT_ONLY = require_roles([UserRole.APPLICANT])

class InviteToApplyRequest(BaseModel):
    candidate_email: EmailStr
    folder_id: Optional[str] = None
    position_title: Optional[str] = None
    message: Optional[str] = None

class EnrollmentInviteRequest(BaseModel):
    invitee_name: str
    invitee_email: EmailStr

class InvitationResponse(BaseModel):
    response: str               # "accepted" or "rejected"
    message: Optional[str] = None   # cover message when accepting
    resume_id: Optional[str] = None  # UUID of the resume version attached by candidate


@router.post("/invite-to-apply", status_code=201)
async def invite_candidate_to_apply(
    data: InviteToApplyRequest,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    # Check if candidate is an HM user
    cand_r = await db.execute(select(User).where(User.email == data.candidate_email.lower()))
    candidate = cand_r.scalar_one_or_none()

    token = generate_secure_token(32)
    expires_at = datetime.utcnow() + timedelta(days=14)

    if not candidate:
        # Not an HM user — send enrollment invitation first
        enroll_token = generate_secure_token(32)
        enrollment = EnrollmentInvitation(
            invited_by_user_id=current_user.id,
            invitee_name=data.candidate_email.split("@")[0],
            invitee_email=data.candidate_email.lower(),
            token=enroll_token,
            expires_at=expires_at,
        )
        db.add(enrollment)
        await db.commit()

        # Send enrollment invitation email
        try:
            signup_url = f"{settings.FRONTEND_URL}/register?invite={enroll_token}"
            inviter_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email
            invitee_name = data.candidate_email.split("@")[0]
            from app.utils.email_templates import email_enrollment_invitation as _enroll_tpl
            subject, body = _enroll_tpl(
                invitee_name=invitee_name,
                inviter_name=inviter_name,
                signup_url=signup_url,
            )
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            if settings.MAIL_ENABLED and settings.MAIL_USERNAME:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"]    = settings.MAIL_FROM
                msg["To"]      = data.candidate_email
                msg.attach(MIMEText(body, "html"))
                with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as srv:
                    srv.ehlo(); srv.starttls()
                    srv.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                    srv.sendmail(settings.MAIL_FROM, [data.candidate_email], msg.as_string())
                print(f"[EMAIL] Enrollment invitation sent to {data.candidate_email}")
            else:
                print(f"[EMAIL] (disabled) Would send enrollment invitation to {data.candidate_email}")
        except Exception as e:
            print(f"[EMAIL ERROR] Enrollment email failed: {e}")

        return {
            "message": "Candidate is not a HiroMetrics user. Enrollment invitation sent.",
            "enrollment_invitation_id": enrollment.id,
        }

    # Candidate is HM user — create direct invitation
    org_r = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_r.scalar_one_or_none()

    invitation = Invitation(
        org_id=current_user.org_id,
        folder_id=data.folder_id,
        invited_by=current_user.id,
        candidate_email=data.candidate_email.lower(),
        candidate_id=candidate.id,
        position_title=data.position_title,
        message=data.message,
        token=token,
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.commit()

    # Send invitation to apply email
    try:
        inviter_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email
        candidate_name = f"{candidate.first_name} {candidate.last_name}".strip() or data.candidate_email
        position = data.position_title or (org.name if org else "a position")
        org_name = org.name if org else "HiroMetrics"
        inbox_url = f"{settings.FRONTEND_URL}/applicant/inbox"
        subject, body = email_invitation_to_apply(
            candidate_name=candidate_name,
            manager_name=inviter_name,
            org_name=org_name,
            position=position,
            accept_url=inbox_url,
        )
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        if settings.MAIL_ENABLED and settings.MAIL_USERNAME:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"]    = settings.MAIL_FROM
            msg["To"]      = data.candidate_email
            msg.attach(MIMEText(body, "html"))
            with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as srv:
                srv.ehlo(); srv.starttls()
                srv.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                srv.sendmail(settings.MAIL_FROM, [data.candidate_email], msg.as_string())
            print(f"[EMAIL] Invitation sent to {data.candidate_email}")
        else:
            print(f"[EMAIL] (disabled) Would send invitation to {data.candidate_email}")
    except Exception as e:
        print(f"[EMAIL ERROR] Invitation email failed: {e}")

    return {
        "message": "Invitation sent",
        "invitation_id": invitation.id,
        "candidate_name": f"{candidate.first_name} {candidate.last_name}",
    }


@router.get("/my-invitations")
async def get_my_invitations(
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Invitation).where(
        Invitation.candidate_id == current_user.id,
        Invitation.status == "pending"
    ).order_by(Invitation.sent_at.desc()))
    invitations = r.scalars().all()
    results = []
    for inv in invitations:
        org_r = await db.execute(select(Organization).where(Organization.id == inv.org_id))
        org = org_r.scalar_one_or_none()
        inviter_r = await db.execute(select(User).where(User.id == inv.invited_by))
        inviter = inviter_r.scalar_one_or_none()
        # Get folder/job details if linked
        folder_info = {}
        if inv.folder_id:
            from app.models.models import Folder
            folder_r = await db.execute(select(Folder).where(Folder.id == inv.folder_id))
            folder = folder_r.scalar_one_or_none()
            if folder:
                folder_info = {
                    "position_code": folder.name,
                    "position_title": folder.position_title or inv.position_title,
                    "job_description": folder.description,
                }
        results.append({
            "id": inv.id,
            "org_name": org.name if org else None,
            "position_title": folder_info.get("position_title") or inv.position_title,
            "position_code": folder_info.get("position_code"),
            "job_description": folder_info.get("job_description"),
            "message": inv.message,
            "invited_by": f"{inviter.first_name} {inviter.last_name}" if inviter else None,
            "sent_at": inv.sent_at.isoformat(),
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
            "status": inv.status,
        })
    return results


@router.post("/{invitation_id}/respond")
async def respond_to_invitation(
    invitation_id: str, data: InvitationResponse,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    if data.response not in ["accepted", "rejected"]:
        raise HTTPException(400, "Response must be 'accepted' or 'rejected'")

    r = await db.execute(select(Invitation).where(
        Invitation.id == invitation_id, Invitation.candidate_id == current_user.id))
    invitation = r.scalar_one_or_none()
    if not invitation: raise HTTPException(404, "Invitation not found")
    if invitation.status != "pending": raise HTTPException(409, "Invitation already responded to")
    if invitation.expires_at and invitation.expires_at < datetime.utcnow():
        raise HTTPException(410, "Invitation has expired")

    invitation.status = data.response
    invitation.responded_at = datetime.utcnow()
    if data.message:
        invitation.message = data.message  # store cover message in message field

    if data.response == "accepted":
        # Check resume was attached
        from app.models.models import Resume as _Resume
        inv_resume_id = data.resume_id
        if inv_resume_id:
            resume_check = await db.execute(select(_Resume).where(_Resume.id == inv_resume_id))
            if not resume_check.scalar_one_or_none():
                raise HTTPException(400, "Submission failed. Profile should be complete and resume has to be attached. Please update and resubmit.")
        else:
            # Fall back to active resume
            inv_prof_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
            inv_prof = inv_prof_r.scalar_one_or_none()
            if inv_prof:
                active_r = await db.execute(select(_Resume).where(
                    _Resume.profile_id == inv_prof.id, _Resume.is_current == True
                ))
                active = active_r.scalar_one_or_none()
                if active:
                    inv_resume_id = active.id
        if not inv_resume_id:
            raise HTTPException(400, "Submission failed. Profile should be complete and resume has to be attached. Please update and resubmit.")

        prof_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
        profile = prof_r.scalar_one_or_none()
        if not profile: raise HTTPException(400, "Complete your profile before accepting")

        # Create snapshot
        count_r = await db.execute(select(ProfileSnapshot).where(ProfileSnapshot.profile_id == profile.id))
        version = len(count_r.scalars().all()) + 1
        snapshot_data = await build_snapshot_data(profile.id, db)
        snapshot = ProfileSnapshot(
            profile_id=profile.id, profile_version=version,
            snapshot_data=snapshot_data, triggered_by="invitation_accept"
        )
        db.add(snapshot)
        await db.flush()
        token_str = generate_secure_token(48)
        share_token = ShareToken(
            user_id=current_user.id, profile_snapshot_id=snapshot.id, token=token_str
        )
        db.add(share_token)
        await db.flush()
        app = Application(
            folder_id=invitation.folder_id,
            candidate_id=current_user.id,
            share_token_id=share_token.id,
            submitted_by_org_id=invitation.org_id,
            submitted_by_user_id=current_user.id,
            flow_type="invitation",
            chain_depth=0,
            resume_id=data.resume_id,
        )
        db.add(app)

    # Mark the attached resume as Submitted (Active → Submitted) when accepting
    if data.response == "accepted" and data.resume_id:
        from app.models.models import Resume as _ResumeModel
        inv_resume_r = await db.execute(select(_ResumeModel).where(
            _ResumeModel.id == data.resume_id
        ))
        inv_resume = inv_resume_r.scalar_one_or_none()
        if inv_resume:
            inv_resume.is_current = False

    await db.commit()
    return {"message": f"Invitation {data.response}"}


@router.post("/enrollment", status_code=201)
async def send_enrollment_invitation(
    data: EnrollmentInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    token = generate_secure_token(32)
    enrollment = EnrollmentInvitation(
        invited_by_user_id=current_user.id,
        invitee_name=data.invitee_name,
        invitee_email=data.invitee_email.lower(),
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(enrollment)
    await db.commit()
    # TODO: Send enrollment email
    return {"message": "Enrollment invitation sent", "id": enrollment.id}


@router.get("/my-responses")
async def get_my_responses(
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """All submitted applications for the candidate — both invitation and job-link flows."""
    results = []

    # 1. Accepted invitations
    inv_r = await db.execute(select(Invitation).where(
        Invitation.candidate_id == current_user.id,
        Invitation.status == "accepted"
    ).order_by(Invitation.responded_at.desc()))
    for inv in inv_r.scalars().all():
        org_r = await db.execute(select(Organization).where(Organization.id == inv.org_id))
        org = org_r.scalar_one_or_none()
        app_r = await db.execute(select(Application).where(
            Application.folder_id == inv.folder_id,
            Application.candidate_id == current_user.id,
            Application.flow_type == "invitation",
        ))
        app = app_r.scalars().first()
        share_token = None
        if app:
            share_r = await db.execute(select(ShareToken).where(ShareToken.id == app.share_token_id))
            share = share_r.scalar_one_or_none()
            share_token = share.token if share else None
        # Get resume version
        resume_version = None
        if app and app.resume_id:
            rv_r = await db.execute(select(Resume).where(Resume.id == app.resume_id))
            rv = rv_r.scalar_one_or_none()
            resume_version = rv.version_number if rv else None
        results.append({
            "id": inv.id,
            "flow_type": "invitation",
            "org_name": org.name if org else None,
            "position_title": inv.position_title,
            "position_code": None,
            "status": "accepted",
            "submitted_at": inv.responded_at.isoformat() if inv.responded_at else None,
            "cover_message": inv.message,
            "share_token": share_token,
            "resume_version": resume_version,
        })

    # 2. Job-link applications (CandidateJobLink with status=applied)
    from app.models.models import CandidateJobLink, ApplicationLink, Folder
    link_apps_r = await db.execute(select(CandidateJobLink).where(
        CandidateJobLink.candidate_id == current_user.id,
        CandidateJobLink.status == "applied",
    ).order_by(CandidateJobLink.added_at.desc()))
    for item in link_apps_r.scalars().all():
        folder_r = await db.execute(select(Folder).where(Folder.id == item.folder_id))
        folder = folder_r.scalar_one_or_none()
        org_name = None
        if folder and folder.org_id:
            org_r = await db.execute(select(Organization).where(Organization.id == folder.org_id))
            org = org_r.scalar_one_or_none()
            org_name = org.name if org else None
        app_r = await db.execute(select(Application).where(
            Application.folder_id == item.folder_id,
            Application.candidate_id == current_user.id,
            Application.flow_type == "job_link",
        ))
        app = app_r.scalars().first()
        share_token = None
        if app:
            share_r = await db.execute(select(ShareToken).where(ShareToken.id == app.share_token_id))
            share = share_r.scalar_one_or_none()
            share_token = share.token if share else None
        # Get resume version
        resume_version = None
        if app and app.resume_id:
            rv_r = await db.execute(select(Resume).where(Resume.id == app.resume_id))
            rv = rv_r.scalar_one_or_none()
            resume_version = rv.version_number if rv else None
        results.append({
            "id": item.id,
            "flow_type": "job_link",
            "org_name": org_name,
            "position_title": folder.position_title if folder else "Job Opportunity",
            "position_code": folder.name if folder else None,
            "status": "accepted",
            "submitted_at": item.added_at.isoformat() if item.added_at else None,
            "cover_message": None,
            "share_token": share_token,
            "resume_version": resume_version,
        })

    # Sort combined list by submitted_at descending
    results.sort(key=lambda x: x["submitted_at"] or "", reverse=True)
    return results


# ── Job Link Inbox ────────────────────────────────────────────────────────────

@router.post("/job-links/claim", status_code=201)
async def claim_job_link(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Called when any user clicks a job link and logs in.
    Routes to candidate inbox (applicants) or employer inbox (customer_admin/customer_manager).
    Idempotent — safe to call multiple times for the same link.
    """
    from app.models.models import ApplicationLink, CandidateJobLink, Folder
    link_token = data.get("link_token")
    if not link_token:
        raise HTTPException(400, "link_token is required")

    from sqlalchemy import or_, true
    link_r = await db.execute(select(ApplicationLink).where(
        ApplicationLink.token == link_token,
        or_(ApplicationLink.is_active == True, ApplicationLink.is_active == None)
    ))
    link = link_r.scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Job link not found or inactive")

    folder_r = await db.execute(select(Folder).where(Folder.id == link.folder_id))
    folder = folder_r.scalar_one_or_none()

    is_employer = current_user.role in ("customer_admin", "customer_manager")
    # Use user_id as the key regardless of role — CandidateJobLink stores all inbox items
    existing_r = await db.execute(select(CandidateJobLink).where(
        CandidateJobLink.candidate_id == current_user.id,
        CandidateJobLink.application_link_id == link.id,
    ))
    existing = existing_r.scalar_one_or_none()
    if existing:
        return {
            "message": "Already in inbox",
            "id": existing.id,
            "already_existed": True,
            "role_type": "employer" if is_employer else "candidate",
        }

    inbox_item = CandidateJobLink(
        candidate_id=current_user.id,
        application_link_id=link.id,
        folder_id=link.folder_id,
        status="pending",
    )
    db.add(inbox_item)
    await db.commit()
    await db.refresh(inbox_item)
    return {
        "message": "Job added to your inbox",
        "id": inbox_item.id,
        "folder_name": folder.name if folder else None,
        "already_existed": False,
        "role_type": "employer" if is_employer else "candidate",
    }


@router.get("/my-job-links")
async def get_my_job_links(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns link-based job opportunities in the inbox (candidates and employers)."""
    from app.models.models import ApplicationLink, CandidateJobLink, Folder
    items_r = await db.execute(
        select(CandidateJobLink).where(
            CandidateJobLink.candidate_id == current_user.id,
            CandidateJobLink.status == "pending",
        ).order_by(CandidateJobLink.added_at.desc())
    )
    items = items_r.scalars().all()
    results = []
    for item in items:
        link_r = await db.execute(select(ApplicationLink).where(ApplicationLink.id == item.application_link_id))
        link = link_r.scalar_one_or_none()
        folder_r = await db.execute(select(Folder).where(Folder.id == item.folder_id))
        folder = folder_r.scalar_one_or_none()
        # Get the org that owns this folder
        org_name = None
        if folder and folder.org_id:
            from app.models.models import Organization
            org_r = await db.execute(select(Organization).where(Organization.id == folder.org_id))
            org = org_r.scalar_one_or_none()
            org_name = org.name if org else None

        # Load attached resume info
        attached_resume_data = None
        if item.attached_resume_id:
            ar_r = await db.execute(select(Resume).where(Resume.id == item.attached_resume_id))
            ar = ar_r.scalar_one_or_none()
            if ar:
                attached_resume_data = {
                    "id": ar.id,
                    "version_number": ar.version_number,
                    "original_filename": ar.original_filename,
                    "description": ar.description,
                    "is_current": ar.is_current,
                }
        results.append({
            "id": item.id,
            "link_token": link.token if link else None,
            "folder_id": item.folder_id,
            "position_title": folder.position_title if folder else "Job Opportunity",
            "position_code": folder.name if folder else None,
            "description": _strip_linked_from(folder.description) if folder else None,
            "location": folder.location if folder else None,
            "work_mode": folder.work_mode if folder else None,
            "org_name": org_name,
            "status": item.status,
            "added_at": item.added_at.isoformat(),
            "attached_resume": attached_resume_data,
        })
    return results


@router.post("/job-links/{item_id}/apply")
async def apply_via_inbox_job_link(
    item_id: str,
    data: dict,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """
    Candidate clicks Apply on a Link item in their inbox.
    Creates snapshot -> share token -> application -> HM review queue.
    Marks the inbox item as applied.
    """
    from app.models.models import (
        ApplicationLink, CandidateJobLink, Folder,
        Application, ProfileSnapshot, ShareToken, SubmissionReview
    )
    from app.api.v1.routes.share import build_snapshot_data
    import secrets as _secrets

    item_r = await db.execute(select(CandidateJobLink).where(
        CandidateJobLink.id == item_id,
        CandidateJobLink.candidate_id == current_user.id,
    ))
    item = item_r.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Inbox item not found")
    if item.status == "applied":
        raise HTTPException(409, "You have already applied for this position")

    prof_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = prof_r.scalar_one_or_none()
    if not profile:
        raise HTTPException(400, "Submission failed. Profile should be complete and resume has to be attached. Please update and resubmit.")
    if not profile.baseline_locked:
        raise HTTPException(400, "Submission failed. Profile should be complete and resume has to be attached. Please update and resubmit.")
    # Use explicitly attached resume, or fall back to active resume
    resume_id = data.get("resume_id") if isinstance(data, dict) else getattr(data, "resume_id", None)
    from app.models.models import Resume
    if resume_id:
        resume_r = await db.execute(select(Resume).where(
            Resume.id == resume_id, Resume.profile_id == profile.id
        ))
        if not resume_r.scalar_one_or_none():
            raise HTTPException(400, "Submission failed. Profile should be complete and resume has to be attached. Please update and resubmit.")
    else:
        # Fall back to active resume
        active_r = await db.execute(select(Resume).where(
            Resume.profile_id == profile.id, Resume.is_current == True
        ))
        active = active_r.scalar_one_or_none()
        if not active:
            raise HTTPException(400, "Submission failed. Profile should be complete and resume has to be attached. Please update and resubmit.")
        resume_id = active.id

    # Check for duplicate application on the folder
    dup_r = await db.execute(select(Application).where(
        Application.folder_id == item.folder_id,
        Application.candidate_id == current_user.id,
    ))
    if dup_r.scalar_one_or_none():
        item.status = "applied"
        await db.commit()
        raise HTTPException(409, "You have already applied to this position")

    folder_r = await db.execute(select(Folder).where(Folder.id == item.folder_id))
    folder = folder_r.scalar_one_or_none()

    # Freeze profile
    count_r = await db.execute(select(ProfileSnapshot).where(ProfileSnapshot.profile_id == profile.id))
    version = len(count_r.scalars().all()) + 1
    snapshot_data = await build_snapshot_data(profile.id, db)
    snapshot = ProfileSnapshot(
        profile_id=profile.id, profile_version=version,
        snapshot_data=snapshot_data, triggered_by="job_link_inbox",
    )
    db.add(snapshot)
    await db.flush()

    share_token = ShareToken(
        user_id=current_user.id,
        profile_snapshot_id=snapshot.id,
        token=_secrets.token_urlsafe(48),
        is_active=True,
    )
    db.add(share_token)
    await db.flush()

    application = Application(
        folder_id=item.folder_id,
        candidate_id=current_user.id,
        share_token_id=share_token.id,
        submitted_by_org_id=folder.org_id if folder else None,
        submitted_by_user_id=current_user.id,
        flow_type="job_link",
        chain_depth=0,
        cover_message=data.get("message"),
        resume_id=resume_id,
        status="received",
    )
    db.add(application)
    await db.flush()

    review = SubmissionReview(
        application_id=application.id,
        candidate_id=current_user.id,
        folder_id=item.folder_id,
        status="awaiting_review",
        archived=False,
    )
    db.add(review)

    item.status = "applied"

    # Mark the attached resume as Submitted (Active → Submitted)
    submitted_resume_r = await db.execute(select(Resume).where(
        Resume.id == resume_id, Resume.profile_id == profile.id
    ))
    submitted_resume = submitted_resume_r.scalar_one_or_none()
    if submitted_resume:
        submitted_resume.is_current = False

    await db.commit()

    return {
        "message": "Application submitted successfully",
        "application_id": application.id,
        "folder_name": folder.name if folder else None,
    }


@router.patch("/job-links/{item_id}/attach-resume")
async def attach_resume_to_job_link(
    item_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save the selected resume against a job link inbox item (persists to DB)."""
    item_r = await db.execute(select(CandidateJobLink).where(
        CandidateJobLink.id == item_id,
        CandidateJobLink.candidate_id == current_user.id,
    ))
    item = item_r.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Inbox item not found")
    resume_id = data.get("resume_id")
    if resume_id:
        resume_r = await db.execute(select(Resume).where(Resume.id == resume_id))
        if not resume_r.scalar_one_or_none():
            raise HTTPException(404, "Resume not found")
    item.attached_resume_id = resume_id
    await db.commit()
    return {"message": "Resume attached", "resume_id": resume_id}


@router.delete("/job-links/{item_id}")
async def remove_job_link(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a job link inbox item (candidates and employers)."""
    from app.models.models import CandidateJobLink
    item_r = await db.execute(select(CandidateJobLink).where(
        CandidateJobLink.id == item_id,
        CandidateJobLink.candidate_id == current_user.id,
    ))
    item = item_r.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Inbox item not found")
    await db.delete(item)
    await db.commit()
    return {"message": "Removed"}



@router.get("/my-hm-processing-count")
async def get_my_hm_processing_count(
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """Count of this candidate's submissions currently in HM Admin review (not yet sent to employer)."""
    from app.models.models import SubmissionReview
    r = await db.execute(select(SubmissionReview).where(
        SubmissionReview.candidate_id == current_user.id,
        SubmissionReview.archived == False,
    ))
    return {"count": len(r.scalars().all())}

@router.post("/job-links/{item_id}/create-folder", status_code=201)
async def create_folder_from_link(
    item_id: str,
    data: dict,
    current_user: User = Depends(require_roles(["customer_admin", "customer_manager"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Employer/vendor clicks 'Create Folder' on a job link inbox item.
    Creates a new job folder in the employer's org, linked to the original
    folder via parent_folder_id reference stored in the description.
    """
    from app.models.models import ApplicationLink, CandidateJobLink, Folder
    from app.core.security import generate_secure_token as _gen_token

    folder_name = (data.get("folder_name") or "").strip()
    if not folder_name:
        raise HTTPException(400, "folder_name is required")

    item_r = await db.execute(select(CandidateJobLink).where(
        CandidateJobLink.id == item_id,
        CandidateJobLink.candidate_id == current_user.id,
    ))
    item = item_r.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Inbox item not found")

    # Load source folder for reference
    src_folder_r = await db.execute(select(Folder).where(Folder.id == item.folder_id))
    src_folder = src_folder_r.scalar_one_or_none()

    if not current_user.org_id:
        raise HTTPException(400, "Your account is not associated with an organization")

    new_folder = Folder(
        org_id=current_user.org_id,
        owner_id=current_user.id,
        created_by=current_user.id,
        name=folder_name,
        position_title=src_folder.position_title if src_folder else folder_name,
        description=(
            f"[Linked from: {src_folder.name}]\n\n{src_folder.description or ''}"
            if src_folder else ""
        ),
        skill_set=src_folder.skill_set if src_folder else None,
        location=src_folder.location if src_folder else None,
        work_mode=src_folder.work_mode if src_folder else None,
        duration=src_folder.duration if src_folder else None,
        job_start_date=src_folder.job_start_date if src_folder else None,
        work_auth_required=src_folder.work_auth_required if src_folder else None,
        unique_link_token=_gen_token(24),
        status="open",
        is_archived=False,
    )
    db.add(new_folder)
    item.status = "folder_created"
    await db.commit()
    await db.refresh(new_folder)

    return {
        "message": "Job folder created",
        "folder_id": new_folder.id,
        "folder_name": new_folder.name,
        "linked_from": src_folder.name if src_folder else None,
    }

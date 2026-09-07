"""
Dev-only simulation endpoints — repeatable demo flows without email.
All endpoints require hm_super_admin or hm_admin.

Flows covered:
  GET  /simulate/state              — list all users, folders, links (pick IDs from here)
  POST /simulate/job-link           — create an ApplicationLink for a folder (like employer clicking Job Link)
  POST /simulate/invite             — create an invitation from an employer folder to a candidate
  POST /simulate/submit-via-link    — candidate submits via a job link token -> queues in HM review
  POST /simulate/submit-via-invite  — candidate accepts an invitation -> queues in HM review
  POST /simulate/vendor-forward     — employer forwards an application to another org's folder (chaining)
  POST /simulate/reset              — wipe all sim data for a fresh demo run (keeps users + profiles)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import (
    User, Invitation, Application, ApplicantProfile,
    ShareToken, ProfileSnapshot, Folder, ApplicationLink,
    SubmissionReview, Organization
)
from app.core.dependencies import require_roles
from app.core.security import generate_secure_token
from app.api.v1.routes.share import build_snapshot_data

router = APIRouter()
HM_ONLY = require_roles(["hm_super_admin", "hm_admin"])


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class JobLinkRequest(BaseModel):
    folder_id: str
    label: Optional[str] = None

class InviteRequest(BaseModel):
    folder_id: str
    candidate_email: str
    message: Optional[str] = "You are invited to apply for this position."

class SubmitViaLinkRequest(BaseModel):
    link_token: str
    candidate_email: str
    cover_message: Optional[str] = None

class SubmitViaInviteRequest(BaseModel):
    invitation_id: str
    cover_message: Optional[str] = None

class VendorForwardRequest(BaseModel):
    application_id: str
    to_folder_id: str


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_candidate(email: str, db: AsyncSession) -> User:
    r = await db.execute(select(User).where(
        User.email == email.lower(), User.role == "applicant"
    ))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(404, f"No applicant found with email: {email}")
    return u


async def _get_locked_profile(candidate: User, db: AsyncSession) -> ApplicantProfile:
    r = await db.execute(select(ApplicantProfile).where(
        ApplicantProfile.user_id == candidate.id
    ))
    profile = r.scalar_one_or_none()
    if not profile:
        raise HTTPException(400, f"{candidate.email} has no profile")
    if not profile.baseline_locked:
        raise HTTPException(
            400,
            f"{candidate.email} profile is not locked/submitted. "
            "Have the candidate complete and submit their profile first."
        )
    return profile


async def _create_snapshot_and_token(
    candidate: User, profile: ApplicantProfile, triggered_by: str, db: AsyncSession
) -> ShareToken:
    count_r = await db.execute(
        select(ProfileSnapshot).where(ProfileSnapshot.profile_id == profile.id)
    )
    version = len(count_r.scalars().all()) + 1
    snapshot_data = await build_snapshot_data(profile.id, db)
    snapshot = ProfileSnapshot(
        profile_id=profile.id,
        profile_version=version,
        snapshot_data=snapshot_data,
        triggered_by=triggered_by,
    )
    db.add(snapshot)
    await db.flush()
    share_token = ShareToken(
        user_id=candidate.id,
        profile_snapshot_id=snapshot.id,
        token=generate_secure_token(48),
        is_active=True,
    )
    db.add(share_token)
    await db.flush()
    return share_token


async def _queue_for_hm_review(
    application: Application, candidate: User, db: AsyncSession
) -> SubmissionReview:
    review = SubmissionReview(
        application_id=application.id,
        candidate_id=candidate.id,
        folder_id=application.folder_id,
        status="awaiting_review",
        archived=False,
    )
    db.add(review)
    await db.flush()
    return review


# ── GET /simulate/state ────────────────────────────────────────────────────────

@router.get("/state")
async def get_sim_state(
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns everything needed to drive a demo without guessing IDs:
    - active candidates with profile lock status
    - all orgs, their folders, and active job links per folder
    - pending invitations
    - current HM review queue
    """
    # Candidates
    cands_r = await db.execute(
        select(User, ApplicantProfile)
        .join(ApplicantProfile, ApplicantProfile.user_id == User.id, isouter=True)
        .where(User.role == "applicant", User.status == "active")
    )
    candidates = []
    for u, p in cands_r.all():
        candidates.append({
            "id": u.id,
            "name": f"{u.first_name} {u.last_name}",
            "email": u.email,
            "profile_locked": p.baseline_locked if p else False,
            "wizard_step": p.wizard_step if p else 0,
        })

    # Orgs + folders + links
    orgs_r = await db.execute(select(Organization))
    orgs = []
    for org in orgs_r.scalars().all():
        folders_r = await db.execute(
            select(Folder).where(Folder.org_id == org.id, Folder.is_archived == False)
        )
        folders = []
        for f in folders_r.scalars().all():
            links_r = await db.execute(
                select(ApplicationLink).where(
                    ApplicationLink.folder_id == f.id, ApplicationLink.is_active == True
                )
            )
            links = [
                {
                    "link_id": l.id,
                    "token": l.token,
                    "label": l.label,
                    "apply_url": f"http://localhost:5173/apply/{l.token}",
                    "application_count": l.application_count,
                }
                for l in links_r.scalars().all()
            ]
            folders.append({
                "folder_id": f.id,
                "position_code": f.name,
                "position_title": f.position_title,
                "active_job_links": links,
            })
        orgs.append({"org_id": org.id, "org_name": org.name, "folders": folders})

    # Pending invitations
    inv_r = await db.execute(
        select(Invitation).where(Invitation.status == "pending")
        .order_by(Invitation.sent_at.desc())
    )
    invitations = []
    for inv in inv_r.scalars().all():
        invitations.append({
            "invitation_id": inv.id,
            "candidate_email": inv.candidate_email,
            "position_title": inv.position_title,
            "status": inv.status,
            "sent_at": inv.sent_at.isoformat(),
        })

    # HM review queue
    q_r = await db.execute(
        select(SubmissionReview).where(SubmissionReview.archived == False)
        .order_by(SubmissionReview.created_at.desc())
    )
    queue = []
    for rev in q_r.scalars().all():
        cand_r = await db.execute(select(User).where(User.id == rev.candidate_id))
        cand = cand_r.scalar_one_or_none()
        folder_r = await db.execute(select(Folder).where(Folder.id == rev.folder_id))
        folder = folder_r.scalar_one_or_none()
        queue.append({
            "review_id": rev.id,
            "application_id": rev.application_id,
            "candidate": f"{cand.first_name} {cand.last_name}" if cand else "?",
            "folder": folder.name if folder else "?",
            "status": rev.status,
        })

    return {
        "candidates": candidates,
        "organizations": orgs,
        "pending_invitations": invitations,
        "hm_review_queue": queue,
    }


# ── POST /simulate/job-link ────────────────────────────────────────────────────

@router.post("/job-link")
async def simulate_create_job_link(
    data: JobLinkRequest,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates an ApplicationLink for a folder — same as the employer clicking the Job Link button.
    Returns the full clickable URL to paste into Word, Outlook, or any editor.
    Clicking the URL takes the user to /apply/<token> on the frontend.
    If not logged in, the page redirects to login first, then returns to the apply page.
    """
    folder_r = await db.execute(select(Folder).where(Folder.id == data.folder_id))
    folder = folder_r.scalar_one_or_none()
    if not folder:
        raise HTTPException(404, f"Folder not found: {data.folder_id}")
    if folder.is_archived:
        raise HTTPException(409, "Cannot create links for archived folders")

    token = generate_secure_token(24)
    link = ApplicationLink(
        folder_id=data.folder_id,
        token=token,
        label=data.label or folder.name,
        is_active=True,
        application_count=0,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    apply_url = f"http://localhost:5173/apply/{token}"
    return {
        "message": "Job link created",
        "link_id": link.id,
        "token": token,
        "label": link.label,
        "apply_url": apply_url,
        "html_link": f'<a href="{apply_url}">{link.label}</a>',
        "instructions": (
            "Paste apply_url into any browser, Word doc, or email. "
            "Clicking redirects to HiroMetrics login if not signed in, "
            "then lands on the Apply page. If the recipient is a candidate, "
            "they apply directly. If they are a vendor/employer, they can "
            "create a linked folder and generate a new link for their own candidates."
        ),
    }


# ── POST /simulate/invite ──────────────────────────────────────────────────────

@router.post("/invite")
async def simulate_invite(
    data: InviteRequest,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a pending Invitation from a folder to a candidate.
    The invitation appears immediately in the candidate's Inbox as type 'Invite'.
    The candidate can: View → Apply → submit from there.
    """
    folder_r = await db.execute(select(Folder).where(Folder.id == data.folder_id))
    folder = folder_r.scalar_one_or_none()
    if not folder:
        raise HTTPException(404, f"Folder not found: {data.folder_id}")

    candidate = await _get_candidate(data.candidate_email, db)

    # Check for duplicate pending invitation
    dup_r = await db.execute(select(Invitation).where(
        Invitation.candidate_id == candidate.id,
        Invitation.folder_id == data.folder_id,
        Invitation.status == "pending",
    ))
    if dup_r.scalar_one_or_none():
        raise HTTPException(409, "A pending invitation already exists for this candidate + folder")

    # Find an employer user in the folder's org to use as the inviter
    inviter_r = await db.execute(select(User).where(
        User.org_id == folder.org_id,
        User.role.in_(["customer_admin", "customer_manager"]),
        User.status == "active",
    ))
    inviter = inviter_r.scalars().first()
    if not inviter:
        raise HTTPException(
            400,
            f"No active employer user found in org for folder {folder.name}. "
            "Create a customer_admin user for that org first."
        )

    invitation = Invitation(
        org_id=folder.org_id,
        folder_id=data.folder_id,
        invited_by=inviter.id,
        candidate_email=data.candidate_email.lower(),
        candidate_id=candidate.id,
        position_title=folder.position_title or folder.name,
        message=data.message,
        token=generate_secure_token(32),
        expires_at=datetime.utcnow() + timedelta(days=14),
        status="pending",
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    return {
        "message": "Invitation created — appears in candidate Inbox immediately",
        "invitation_id": invitation.id,
        "candidate": f"{candidate.first_name} {candidate.last_name}",
        "folder": folder.name,
        "instructions": (
            f"Log in as {candidate.email} → Inbox → "
            "invitation appears under type 'Invite' → View → Apply."
        ),
    }


# ── POST /simulate/submit-via-link ─────────────────────────────────────────────

@router.post("/submit-via-link")
async def simulate_submit_via_link(
    data: SubmitViaLinkRequest,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db),
):
    """
    Simulates a candidate clicking a job link and submitting their profile.
    Full flow: validates link -> validates profile locked -> snapshot -> share token
               -> application -> SubmissionReview queued for HM Admin.
    Use this when you want to skip the browser click and drive the demo from the API.
    """
    link_r = await db.execute(select(ApplicationLink).where(
        ApplicationLink.token == data.link_token, ApplicationLink.is_active == True
    ))
    link = link_r.scalar_one_or_none()
    if not link:
        raise HTTPException(404, f"No active job link found with token: {data.link_token}")

    candidate = await _get_candidate(data.candidate_email, db)
    profile = await _get_locked_profile(candidate, db)

    dup_r = await db.execute(select(Application).where(
        Application.folder_id == link.folder_id,
        Application.candidate_id == candidate.id,
    ))
    if dup_r.scalar_one_or_none():
        raise HTTPException(409, f"{candidate.email} has already applied to this folder")

    folder_r = await db.execute(select(Folder).where(Folder.id == link.folder_id))
    folder = folder_r.scalar_one_or_none()

    share_token = await _create_snapshot_and_token(candidate, profile, "job_link", db)

    application = Application(
        folder_id=link.folder_id,
        candidate_id=candidate.id,
        share_token_id=share_token.id,
        submitted_by_org_id=folder.org_id if folder else None,
        submitted_by_user_id=candidate.id,
        flow_type="job_link",
        chain_depth=0,
        cover_message=data.cover_message,
        status="received",
    )
    db.add(application)
    link.application_count = (link.application_count or 0) + 1
    await db.flush()

    review = await _queue_for_hm_review(application, candidate, db)
    await db.commit()

    return {
        "message": "Application submitted via job link — queued in HM Admin Active Requests",
        "application_id": application.id,
        "review_id": review.id,
        "candidate": f"{candidate.first_name} {candidate.last_name}",
        "folder": folder.name if folder else "?",
        "next_step": (
            "Log in as HM Admin -> Active Requests -> open the slide-over panel -> "
            "set status to Ready to Send -> upload discrepancy report -> set disposition flag -> Send."
        ),
    }


# ── POST /simulate/submit-via-invite ──────────────────────────────────────────

@router.post("/submit-via-invite")
async def simulate_submit_via_invite(
    data: SubmitViaInviteRequest,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db),
):
    """
    Simulates a candidate accepting an invitation from their Inbox.
    Full flow: marks invitation accepted -> snapshot -> share token
               -> application -> SubmissionReview queued for HM Admin.
    """
    inv_r = await db.execute(select(Invitation).where(
        Invitation.id == data.invitation_id, Invitation.status == "pending"
    ))
    invitation = inv_r.scalar_one_or_none()
    if not invitation:
        raise HTTPException(404, f"No pending invitation found with id: {data.invitation_id}")

    cand_r = await db.execute(select(User).where(User.id == invitation.candidate_id))
    candidate = cand_r.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, "Candidate linked to invitation not found")

    profile = await _get_locked_profile(candidate, db)

    share_token = await _create_snapshot_and_token(candidate, profile, "invitation_accept", db)

    application = Application(
        folder_id=invitation.folder_id,
        candidate_id=candidate.id,
        share_token_id=share_token.id,
        submitted_by_org_id=invitation.org_id,
        submitted_by_user_id=candidate.id,
        flow_type="invitation",
        chain_depth=0,
        cover_message=data.cover_message,
        status="received",
    )
    db.add(application)
    invitation.status = "accepted"
    invitation.responded_at = datetime.utcnow()
    await db.flush()

    review = await _queue_for_hm_review(application, candidate, db)
    await db.commit()

    return {
        "message": "Invitation accepted — application queued in HM Admin Active Requests",
        "application_id": application.id,
        "review_id": review.id,
        "candidate": f"{candidate.first_name} {candidate.last_name}",
        "next_step": (
            "Log in as HM Admin -> Active Requests -> open the slide-over panel -> "
            "set status to Ready to Send -> upload discrepancy report -> set disposition flag -> Send."
        ),
    }


# ── POST /simulate/vendor-forward ─────────────────────────────────────────────

@router.post("/vendor-forward")
async def simulate_vendor_forward(
    data: VendorForwardRequest,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db),
):
    """
    Simulates a vendor/employer forwarding a candidate's application to another
    org's folder (the end hiring manager). This is the vendor sub-chaining flow:
      - creates a child Application linked to the parent (chain_depth +1)
      - queues a new SubmissionReview for HM Admin to review before the end employer sees it
    After HM sends, the application appears in the destination org's folder.
    """
    app_r = await db.execute(select(Application).where(Application.id == data.application_id))
    parent_app = app_r.scalar_one_or_none()
    if not parent_app:
        raise HTTPException(404, f"Application not found: {data.application_id}")

    dest_folder_r = await db.execute(select(Folder).where(Folder.id == data.to_folder_id))
    dest_folder = dest_folder_r.scalar_one_or_none()
    if not dest_folder:
        raise HTTPException(404, f"Destination folder not found: {data.to_folder_id}")
    if dest_folder.is_archived:
        raise HTTPException(409, "Destination folder is archived")

    cand_r = await db.execute(select(User).where(User.id == parent_app.candidate_id))
    candidate = cand_r.scalar_one_or_none()

    child_app = Application(
        folder_id=data.to_folder_id,
        candidate_id=parent_app.candidate_id,
        share_token_id=parent_app.share_token_id,   # same frozen snapshot, no re-snap needed
        parent_application_id=parent_app.id,
        submitted_by_org_id=parent_app.submitted_by_org_id,
        submitted_by_user_id=parent_app.submitted_by_user_id,
        flow_type="direct_share",
        chain_depth=(parent_app.chain_depth or 0) + 1,
        cover_message=parent_app.cover_message,
        status="received",
    )
    db.add(child_app)
    parent_app.status = "submitted_up"
    await db.flush()

    review = await _queue_for_hm_review(child_app, candidate, db)
    await db.commit()

    src_folder_r = await db.execute(select(Folder).where(Folder.id == parent_app.folder_id))
    src_folder = src_folder_r.scalar_one_or_none()

    return {
        "message": "Application forwarded — queued in HM Admin review for destination org",
        "parent_application_id": parent_app.id,
        "child_application_id": child_app.id,
        "review_id": review.id,
        "chain_depth": child_app.chain_depth,
        "from_folder": src_folder.name if src_folder else "?",
        "to_folder": dest_folder.name,
        "candidate": f"{candidate.first_name} {candidate.last_name}" if candidate else "?",
        "next_step": (
            "Log in as HM Admin -> Active Requests -> review the forwarded application -> "
            "Send to destination employer. It will appear in the destination folder."
        ),
    }


# ── POST /simulate/reset ──────────────────────────────────────────────────────

@router.post("/reset")
async def simulate_reset(
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db),
):
    """
    Wipes all simulation-generated transactional data for a clean demo run.

    KEEPS:   users, applicant_profiles, work_history, education, certifications,
             references, resumes, photos, organizations, folders, subscription data.

    DELETES: submission_reviews, applications, share_tokens, profile_snapshots,
             invitations, application_links.

    Run this between demo sessions to start fresh without re-creating users.
    """
    await db.execute(delete(SubmissionReview))
    await db.execute(delete(Application))
    await db.execute(delete(ShareToken))
    await db.execute(delete(ProfileSnapshot))
    await db.execute(delete(Invitation))
    await db.execute(delete(ApplicationLink))
    await db.commit()

    return {
        "message": "Simulation data cleared. Users, profiles, and org structure preserved.",
        "deleted_tables": [
            "submission_reviews",
            "applications",
            "share_tokens",
            "profile_snapshots",
            "invitations",
            "application_links",
        ],
    }

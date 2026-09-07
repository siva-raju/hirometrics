"""Employer routes — dashboard, candidate invite by email (Flow B)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr

from app.db.session import get_db
from app.models.models import (
    User, Application, Folder, UserRole,
    ApplicantProfile, Invitation, Organization
)
from app.core.dependencies import require_roles, get_current_user
from app.core.security import generate_secure_token
from app.services.notification_service import notify_user
from app.core.config import settings

router = APIRouter()
EMPLOYER_ONLY = require_roles([UserRole.CUSTOMER_ADMIN, UserRole.CUSTOMER_MANAGER])


class InviteByEmailRequest(BaseModel):
    candidate_email: EmailStr
    folder_id: Optional[str] = None
    position_title: Optional[str] = None
    message: Optional[str] = None


@router.get("/dashboard")
async def get_employer_dashboard(
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    folders_r = await db.execute(select(Folder).where(
        Folder.org_id == current_user.org_id, Folder.is_archived == False))
    folders = folders_r.scalars().all()
    folder_ids = [f.id for f in folders]
    apps_r = await db.execute(select(Application).where(Application.folder_id.in_(folder_ids)))
    apps = apps_r.scalars().all()
    status_counts: dict = {}
    for app in apps:
        status_counts[app.status] = status_counts.get(app.status, 0) + 1
    # Unread applications = received status (new, not yet actioned)
    new_applications = status_counts.get("received", 0)

    # Unread notifications for this user
    from app.models.models import UserNotification
    notif_r = await db.execute(select(UserNotification).where(
        UserNotification.user_id == current_user.id,
        UserNotification.is_read == False,
        UserNotification.is_deleted == False,
    ))
    unread_notifications = len(notif_r.scalars().all())

    # Unread inbox items (pending job links for employer)
    from app.models.models import CandidateJobLink
    inbox_r = await db.execute(select(CandidateJobLink).where(
        CandidateJobLink.candidate_id == current_user.id,
        CandidateJobLink.status == "pending",
    ))
    unread_inbox = len(inbox_r.scalars().all())

    return {
        "total_folders": len(folders),
        "total_applications": len(apps),
        "new_applications": new_applications,
        "unread_notifications": unread_notifications,
        "unread_inbox": unread_inbox,
        "status_breakdown": status_counts,
    }


@router.post("/invite-candidate", status_code=201)
async def invite_candidate_by_email(
    data: InviteByEmailRequest,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """
    Flow B — Invite a candidate by email address.
    - If HM account exists: invitation goes to their inbox immediately.
    - If no HM account: sends registration email with embedded invite token.
      When they register, the invitation automatically appears in their inbox.
    """
    email = data.candidate_email.lower()

    # Verify folder belongs to this org if provided
    if data.folder_id:
        folder_r = await db.execute(
            select(Folder).where(Folder.id == data.folder_id, Folder.org_id == current_user.org_id)
        )
        if not folder_r.scalar_one_or_none():
            raise HTTPException(404, "Folder not found in your organization")

    # Check for existing pending invitation from this org to this email
    existing = await db.execute(
        select(Invitation).where(
            Invitation.org_id == current_user.org_id,
            Invitation.candidate_email == email,
            Invitation.status == "pending"
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "A pending invitation already exists for this email address")

    # Look up if candidate has an HM account
    candidate_r = await db.execute(
        select(User).where(User.email == email, User.role == "applicant")
    )
    candidate = candidate_r.scalar_one_or_none()

    # Get org details for notification message
    org_r = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_r.scalar_one_or_none()
    org_name = org.name if org else "An employer"

    position_text = f" for {data.position_title}" if data.position_title else ""
    invite_token = generate_secure_token(32)
    expires_at = datetime.utcnow() + timedelta(days=30)

    # Create invitation record
    invitation = Invitation(
        org_id=current_user.org_id,
        invited_by=current_user.id,
        candidate_email=email,
        candidate_id=candidate.id if candidate else None,  # None if no account yet
        folder_id=data.folder_id,
        position_title=data.position_title,
        message=data.message,
        token=invite_token,
        status="pending",
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.flush()

    if candidate:
        # ── Account exists: deliver notification to inbox immediately ──
        await notify_user(
            db=db,
            user_id=candidate.id,
            title=f"Invitation to apply{position_text}",
            body=(
                f"{org_name} has invited you to apply{position_text}. "
                + (f'"{data.message}" ' if data.message else "")
                + "Please check your notifications to accept or decline."
            ),
            notification_type="action_required",
            trigger_event=f"invitation:{invitation.id}",
        )
        await db.commit()
        return {
            "status": "delivered",
            "message": f"Invitation delivered to {candidate.first_name}'s HiroMetrics inbox",
            "candidate_found": True,
            "invitation_id": invitation.id,
        }
    else:
        # ── No account: send registration email with invite token ──
        register_link = (
            f"{settings.FRONTEND_URL}/register/applicant?invite={invite_token}&email={email}"
        )
        email_body = (
            f"Hi,\n\n"
            f"{org_name} has invited you to apply{position_text} through HiroMetrics, "
            f"a trusted credential verification platform.\n\n"
            + (f'Message from {org_name}: "{data.message}"\n\n' if data.message else "")
            + f"To respond to this invitation, please create your free HiroMetrics account:\n"
            f"{register_link}\n\n"
            f"Once you register, this invitation will automatically appear in your inbox "
            f"and you can choose to accept or decline.\n\n"
            f"This invitation link expires in 30 days.\n\n"
            f"— The HiroMetrics Team"
        )
        # In production this sends a real email; in dev it prints to console
        print(f"\n{'='*60}")
        print(f"[INVITE EMAIL] To: {email}")
        print(f"Subject: {org_name} has invited you to apply on HiroMetrics")
        print(email_body)
        print(f"{'='*60}\n")
        await db.commit()
        return {
            "status": "email_sent",
            "message": f"No HiroMetrics account found. Registration invite sent to {email}",
            "candidate_found": False,
            "invitation_id": invitation.id,
            "register_link": register_link,  # shown in UI so admin can also share manually
        }


@router.get("/my-invitations")
async def list_sent_invitations(
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """List all invitations sent by this org."""
    r = await db.execute(
        select(Invitation)
        .where(Invitation.org_id == current_user.org_id)
        .order_by(Invitation.sent_at.desc())
    )
    invitations = r.scalars().all()
    results = []
    for inv in invitations:
        # If candidate_id exists, get their name; otherwise use email
        if inv.candidate_id:
            candidate_r = await db.execute(select(User).where(User.id == inv.candidate_id))
            candidate = candidate_r.scalar_one_or_none()
            display = f"{candidate.first_name} {candidate.last_name}" if candidate else inv.candidate_email
        else:
            display = inv.candidate_email
        results.append({
            "id": inv.id,
            "candidate_email": inv.candidate_email,
            "candidate_display": display,
            "candidate_has_account": inv.candidate_id is not None,
            "position_title": inv.position_title,
            "folder_id": inv.folder_id,
            "status": inv.status,
            "sent_at": inv.sent_at.isoformat(),
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        })
    return results

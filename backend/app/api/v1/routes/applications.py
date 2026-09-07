"""Application routes — all 4 flows, status, flagging, tier forwarding, genealogy."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import (User, Application, Folder, ShareToken, ApplicationLink,
    CandidateVendorRequest, Organization, UserRole, SubmissionReview)
from app.core.dependencies import get_current_user, require_roles
from app.core.security import generate_secure_token
from app.api.v1.routes.share import build_snapshot_data
from app.models.models import ApplicantProfile, ProfileSnapshot

router = APIRouter()
EMPLOYER_ONLY = require_roles([UserRole.CUSTOMER_ADMIN, UserRole.CUSTOMER_MANAGER])
APPLICANT_ONLY = require_roles([UserRole.APPLICANT])

class UpdateStatusRequest(BaseModel):
    status: str
    comments: Optional[str] = None

class SubmitUpRequest(BaseModel):
    next_org_id: Optional[str] = None
    next_manager_email: Optional[str] = None
    target_folder_id: Optional[str] = None

class VendorRequestCreate(BaseModel):
    vendor_email: str
    message: Optional[str] = None

class ApplyViaLinkResponse(BaseModel):
    link_token: str

async def create_snapshot_and_token(user_id: str, profile_id: str, db: AsyncSession) -> ShareToken:
    """Create a frozen snapshot and share token for a candidate."""
    count_r = await db.execute(select(ProfileSnapshot).where(ProfileSnapshot.profile_id == profile_id))
    version = len(count_r.scalars().all()) + 1
    snapshot_data = await build_snapshot_data(profile_id, db)
    snapshot = ProfileSnapshot(
        profile_id=profile_id, profile_version=version,
        snapshot_data=snapshot_data, triggered_by="application"
    )
    db.add(snapshot)
    await db.flush()
    token_str = generate_secure_token(48)
    share_token = ShareToken(
        user_id=user_id, profile_snapshot_id=snapshot.id,
        token=token_str, is_active=True,
    )
    db.add(share_token)
    await db.flush()
    return share_token

def app_to_dict(a: Application) -> dict:
    return {
        "id": a.id, "folder_id": a.folder_id, "candidate_id": a.candidate_id,
        "share_token_id": a.share_token_id, "parent_application_id": a.parent_application_id,
        "flow_type": a.flow_type, "chain_depth": a.chain_depth,
        "status": a.status, "is_flagged": a.is_flagged, "comments": a.comments,
        "received_at": a.received_at.isoformat(),
        "status_updated_at": a.status_updated_at.isoformat() if a.status_updated_at else None,
    }

# ── Get applications in a folder ──────────────────────────────────────────────
@router.get("/folder/{folder_id}")
async def get_folder_applications(
    folder_id: str,
    status: Optional[str] = None,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    # Only show applications that are NOT currently under HM review (not yet sent)
    # An application is visible to the employer only when:
    #   (a) it has no SubmissionReview record, OR
    #   (b) its SubmissionReview has been archived (HM has sent it to recipient)
    from sqlalchemy import exists as sql_exists
    pending_hm_subq = select(SubmissionReview.application_id).where(
        SubmissionReview.archived == False
    ).scalar_subquery()

    query = select(Application).where(
        Application.folder_id == folder_id,
        Application.id.not_in(pending_hm_subq),
    )
    if status:
        query = query.where(Application.status == status)
    r = await db.execute(query.order_by(Application.received_at.desc()))
    apps = r.scalars().all()
    results = []
    for app in apps:
        d = app_to_dict(app)

        # Candidate info
        cand_r = await db.execute(select(User).where(User.id == app.candidate_id))
        cand = cand_r.scalar_one_or_none()
        if cand:
            d["candidate"] = {"email": cand.email, "first_name": cand.first_name, "last_name": cand.last_name}

        # ORGANIZATION = the party that submitted this application
        # For depth-0 direct/job_link/invitation: "Candidate"
        # For any depth > 0 (submit-up): the submitting org name
        if app.chain_depth == 0 and app.flow_type in ("job_link", "invitation", "direct"):
            d["submitted_by"] = {
                "name": f"{cand.first_name} {cand.last_name}" if cand else "Unknown",
                "email": cand.email if cand else None,
                "phone": None,
            }
            d["submitted_by_org"] = "Candidate"
        elif app.submitted_by_org_id:
            org_r = await db.execute(select(Organization).where(Organization.id == app.submitted_by_org_id))
            org = org_r.scalar_one_or_none()
            d["submitted_by_org"] = org.name if org else "Unknown"
            if app.submitted_by_user_id:
                sub_r = await db.execute(select(User).where(User.id == app.submitted_by_user_id))
                submitter = sub_r.scalar_one_or_none()
                d["submitted_by"] = {
                    "name": f"{submitter.first_name} {submitter.last_name}" if submitter else org.name if org else "Unknown",
                    "email": submitter.email if submitter else None,
                    "phone": None,
                }
            else:
                d["submitted_by"] = {"name": org.name if org else "Unknown", "email": None, "phone": None}
        else:
            # Fallback for depth-0 non-direct flows
            d["submitted_by"] = {
                "name": f"{cand.first_name} {cand.last_name}" if cand else "Unknown",
                "email": cand.email if cand else None,
                "phone": None,
            }
            d["submitted_by_org"] = "Candidate"

        # Share token for profile view
        if app.share_token_id:
            tok_r = await db.execute(select(ShareToken).where(ShareToken.id == app.share_token_id))
            tok = tok_r.scalar_one_or_none()
            d["share_token"] = tok.token if tok else None
        else:
            d["share_token"] = None

        # Consistency score
        d["consistency_score"] = getattr(app, "consistency_score", "green") or "green"
        d["discrepancies"] = getattr(app, "discrepancies", None) or []
        d["cover_message"] = getattr(app, "cover_message", None)
        d["internal_notes"] = getattr(app, "internal_notes", None)

        # Walk parent chain to find the root application with HM review
        root_app_id = app.id
        current_check = app
        seen_ids = {app.id}
        while current_check.parent_application_id and current_check.parent_application_id not in seen_ids:
            seen_ids.add(current_check.parent_application_id)
            par_r = await db.execute(select(Application).where(Application.id == current_check.parent_application_id))
            par = par_r.scalar_one_or_none()
            if not par: break
            root_app_id = par.id
            current_check = par

        rev_r = await db.execute(
            select(SubmissionReview).where(
                SubmissionReview.application_id == root_app_id,
                SubmissionReview.archived == True
            )
        )
        rev = rev_r.scalar_one_or_none()
        # Use current app.id in URL (not root) so org access check passes for each tier
        d["discrepancy_report_url"] = f"/api/v1/applications/{app.id}/hm-report" if rev and rev.discrepancy_report_filename else None
        d["discrepancy_report_filename"] = rev.discrepancy_report_filename if rev else None

        # Propagate consistency_score from root app so it stays consistent up the chain
        if app.chain_depth > 0:
            root_r = await db.execute(select(Application).where(Application.id == root_app_id))
            root = root_r.scalar_one_or_none()
            if root and root.consistency_score:
                d["consistency_score"] = root.consistency_score
                d["discrepancies"] = root.discrepancies or []

        results.append(d)
    return results

# ── Get inbox (folder_id is null) ─────────────────────────────────────────────
@router.get("/inbox")
async def get_inbox(
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    # Inbox = applications with no folder, for the org's managers
    # Get all folders for this org to find which applications belong here
    folders_r = await db.execute(select(Folder).where(Folder.org_id == current_user.org_id))
    org_folders = [f.id for f in folders_r.scalars().all()]
    # Applications with folder_id=null submitted to this org
    query = select(Application).where(Application.folder_id == None, Application.submitted_by_org_id == current_user.org_id)
    r = await db.execute(query.order_by(Application.received_at.desc()))
    apps = r.scalars().all()
    results = []
    for app in apps:
        d = app_to_dict(app)

        # Candidate info
        cand_r = await db.execute(select(User).where(User.id == app.candidate_id))
        cand = cand_r.scalar_one_or_none()
        if cand:
            d["candidate"] = {"email": cand.email, "first_name": cand.first_name, "last_name": cand.last_name}

        # Determine if this is a direct candidate submission or via a third party
        is_direct = (
            not app.submitted_by_user_id or
            app.submitted_by_user_id == app.candidate_id or
            app.flow_type in ("job_link", "invitation")
        )

        if is_direct:
            # Candidate submitted directly
            d["submitted_by"] = {
                "name": f"{cand.first_name} {cand.last_name}" if cand else "Unknown",
                "email": cand.email if cand else None,
                "phone": None,
            }
            d["submitted_by_org"] = "Candidate"
        else:
            # Submitted by a third party (vendor/manager)
            sub_r = await db.execute(select(User).where(User.id == app.submitted_by_user_id))
            submitter = sub_r.scalar_one_or_none()
            if submitter:
                d["submitted_by"] = {
                    "name": f"{submitter.first_name} {submitter.last_name}",
                    "email": submitter.email,
                    "phone": None,
                }
            # Get the submitting org name
            if app.submitted_by_org_id:
                org_r = await db.execute(select(Organization).where(Organization.id == app.submitted_by_org_id))
                org = org_r.scalar_one_or_none()
                d["submitted_by_org"] = org.name if org else "Unknown"
            else:
                d["submitted_by_org"] = "Unknown"

        # Add folder's org name so frontend knows which org owns this folder
        folder_org_name = None
        if app.folder_id:
            forg_r = await db.execute(
                select(Organization).join(Folder, Folder.org_id == Organization.id)
                .where(Folder.id == app.folder_id)
            )
            forg = forg_r.scalar_one_or_none()
            if forg: folder_org_name = forg.name
        d["folder_org_name"] = folder_org_name

        # Share token for profile view
        if app.share_token_id:
            tok_r = await db.execute(select(ShareToken).where(ShareToken.id == app.share_token_id))
            tok = tok_r.scalar_one_or_none()
            d["share_token"] = tok.token if tok else None
        else:
            d["share_token"] = None

        # Consistency score
        d["consistency_score"] = getattr(app, "consistency_score", "green") or "green"
        d["discrepancies"] = getattr(app, "discrepancies", None) or []
        d["cover_message"] = getattr(app, "cover_message", None)
        d["internal_notes"] = getattr(app, "internal_notes", None)

        results.append(d)
    return results

# ── Flow C — Apply via job folder link ────────────────────────────────────────
@router.post("/apply/{link_token}", status_code=201)
async def apply_via_link(
    link_token: str,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    link_r = await db.execute(select(ApplicationLink).where(ApplicationLink.token == link_token))
    link = link_r.scalar_one_or_none()
    if not link or not link.is_active:
        raise HTTPException(404, "Application link not found or inactive")
    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(410, "This application link has expired")

    # Get candidate profile
    prof_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = prof_r.scalar_one_or_none()
    if not profile: raise HTTPException(400, "Complete your profile before applying")

    # Check duplicate
    dup_r = await db.execute(select(Application).where(
        Application.folder_id == link.folder_id, Application.candidate_id == current_user.id))
    if dup_r.scalar_one_or_none():
        raise HTTPException(409, "You have already applied to this position")

    folder_r = await db.execute(select(Folder).where(Folder.id == link.folder_id))
    folder = folder_r.scalar_one_or_none()

    share_token = await create_snapshot_and_token(current_user.id, profile.id, db)
    app = Application(
        folder_id=link.folder_id,
        candidate_id=current_user.id,
        share_token_id=share_token.id,
        submitted_by_org_id=folder.org_id if folder else None,
        submitted_by_user_id=current_user.id,
        flow_type="job_link",
        chain_depth=0,
    )
    db.add(app)
    link.application_count += 1
    await db.commit()
    return {"message": "Application submitted", "application_id": app.id}

# ── Flow D — Candidate to vendor request ──────────────────────────────────────
@router.post("/vendor-request", status_code=201)
async def create_vendor_request(
    data: VendorRequestCreate,
    current_user: User = Depends(APPLICANT_ONLY),
    db: AsyncSession = Depends(get_db)
):
    prof_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id))
    profile = prof_r.scalar_one_or_none()
    if not profile: raise HTTPException(400, "Complete your profile first")

    share_token = await create_snapshot_and_token(current_user.id, profile.id, db)

    # Check if vendor email maps to an org
    vendor_org_id = None
    org_r = await db.execute(select(Organization).where(
        Organization.org_domain == data.vendor_email.split("@")[-1].lower()))
    org = org_r.scalar_one_or_none()
    if org: vendor_org_id = org.id

    req = CandidateVendorRequest(
        candidate_id=current_user.id,
        share_token_id=share_token.id,
        vendor_email=data.vendor_email,
        vendor_org_id=vendor_org_id,
        message=data.message,
    )
    db.add(req)
    await db.commit()
    # TODO: Send email to vendor with accept/reject link
    return {"message": "Request sent to vendor", "request_id": req.id}

# ── Vendor responds to candidate request ──────────────────────────────────────
@router.post("/vendor-request/{request_id}/respond")
async def respond_vendor_request(
    request_id: str, response: str,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    req_r = await db.execute(select(CandidateVendorRequest).where(CandidateVendorRequest.id == request_id))
    req = req_r.scalar_one_or_none()
    if not req: raise HTTPException(404, "Request not found")
    req.status = response
    req.responded_at = datetime.utcnow()
    if response == "accepted":
        # Create application in Reviewed Profiles (no folder = inbox, flagged as vendor review)
        app = Application(
            folder_id=None,
            candidate_id=req.candidate_id,
            share_token_id=req.share_token_id,
            submitted_by_org_id=current_user.org_id,
            submitted_by_user_id=current_user.id,
            flow_type="candidate_vendor",
            chain_depth=0,
        )
        db.add(app)
    await db.commit()
    return {"message": f"Request {response}"}

# ── Update application status ─────────────────────────────────────────────────
@router.patch("/{app_id}/status")
async def update_application_status(
    app_id: str, data: UpdateStatusRequest,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    valid_statuses = ["received", "under_review", "shortlisted", "not_proceeding", "selected"]
    if data.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Valid: {valid_statuses}")
    r = await db.execute(select(Application).where(Application.id == app_id))
    app = r.scalar_one_or_none()
    if not app: raise HTTPException(404, "Application not found")
    app.status = data.status
    app.status_updated_at = datetime.utcnow()
    if data.comments: app.comments = data.comments
    await db.commit()
    return {"message": "Status updated", **app_to_dict(app)}

# ── Flag / unflag ─────────────────────────────────────────────────────────────
@router.patch("/{app_id}/flag")
async def toggle_flag(
    app_id: str,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Application).where(Application.id == app_id))
    app = r.scalar_one_or_none()
    if not app: raise HTTPException(404, "Not found")
    app.is_flagged = not app.is_flagged
    await db.commit()
    return {"is_flagged": app.is_flagged}

# ── Move to folder ────────────────────────────────────────────────────────────
@router.patch("/{app_id}/move")
async def move_to_folder(
    app_id: str, folder_id: str,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Application).where(Application.id == app_id))
    app = r.scalar_one_or_none()
    if not app: raise HTTPException(404, "Not found")
    folder_r = await db.execute(select(Folder).where(Folder.id == folder_id, Folder.org_id == current_user.org_id))
    folder = folder_r.scalar_one_or_none()
    if not folder: raise HTTPException(404, "Folder not found")
    app.folder_id = folder_id
    await db.commit()
    return {"message": "Moved to folder"}

# ── Submit up — tier forwarding ───────────────────────────────────────────────
@router.post("/{app_id}/submit-up")
async def submit_up(
    app_id: str, data: SubmitUpRequest,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(Application).where(Application.id == app_id))
    parent_app = r.scalar_one_or_none()
    if not parent_app: raise HTTPException(404, "Application not found")
    if parent_app.status in ["submitted_up"]:
        raise HTTPException(409, "This application has already been submitted up")

    next_org_id = data.next_org_id
    target_folder_id = data.target_folder_id if hasattr(data, 'target_folder_id') else None

    # Resolve target folder and org from email
    if data.next_manager_email:
        email = data.next_manager_email.strip().lower()
        # First try direct user lookup
        user_r = await db.execute(select(User).where(User.email.ilike(email)))
        target_user = user_r.scalar_one_or_none()
        if target_user and target_user.org_id:
            if not next_org_id:
                next_org_id = target_user.org_id
            if not target_folder_id:
                # Find folder matching same position title as parent, else most recent
                parent_folder_r = await db.execute(
                    select(Folder).where(Folder.id == parent_app.folder_id)
                )
                parent_folder = parent_folder_r.scalar_one_or_none()
                parent_title = parent_folder.position_title if parent_folder else None

                # Try to find matching folder by position title first
                best = None
                if parent_title:
                    match_r = await db.execute(
                        select(Folder).where(
                            Folder.org_id == target_user.org_id,
                            Folder.is_archived == False,
                            Folder.position_title.ilike(f'%{parent_title}%')
                        ).order_by(Folder.created_at.desc())
                    )
                    best = match_r.scalars().first()

                # Also try matching by folder name keywords (e.g. SAP, ORACLE, AWS)
                if not best and parent_folder:
                    name_words = [w for w in parent_folder.name.split('_') if len(w) > 3 and not w.isdigit()]
                    for word in name_words:
                        kw_r = await db.execute(
                            select(Folder).where(
                                Folder.org_id == target_user.org_id,
                                Folder.is_archived == False,
                                Folder.name.ilike(f'%{word}%')
                            ).order_by(Folder.created_at.desc())
                        )
                        best = kw_r.scalars().first()
                        if best: break

                # Final fallback: most recent folder
                if not best:
                    folder_r = await db.execute(
                        select(Folder).where(
                            Folder.org_id == target_user.org_id,
                            Folder.is_archived == False
                        ).order_by(Folder.created_at.desc())
                    )
                    best = folder_r.scalars().first()

                if best:
                    target_folder_id = best.id
        else:
            # Fallback: match by email domain
            domain = email.split("@")[-1]
            org_r = await db.execute(select(Organization).where(Organization.org_domain == domain))
            org = org_r.scalar_one_or_none()
            if org:
                next_org_id = org.id
                if not target_folder_id:
                    folder_r = await db.execute(
                        select(Folder).where(
                            Folder.org_id == org.id,
                            Folder.is_archived == False
                        ).order_by(Folder.created_at.desc())
                    )
                    best = folder_r.scalars().first()
                    if best:
                        target_folder_id = best.id

    # Carry consistency from root app
    root_consistency = parent_app.consistency_score
    root_discrepancies = parent_app.discrepancies
    check = parent_app
    seen = {parent_app.id}
    while check.parent_application_id and check.parent_application_id not in seen:
        seen.add(check.parent_application_id)
        pr = await db.execute(select(Application).where(Application.id == check.parent_application_id))
        p = pr.scalar_one_or_none()
        if not p: break
        if p.consistency_score: root_consistency = p.consistency_score
        if p.discrepancies: root_discrepancies = p.discrepancies
        check = p

    new_app = Application(
        folder_id=target_folder_id,
        candidate_id=parent_app.candidate_id,
        share_token_id=parent_app.share_token_id,
        parent_application_id=parent_app.id,
        submitted_by_org_id=current_user.org_id,
        submitted_by_user_id=current_user.id,
        flow_type="direct_share",
        chain_depth=parent_app.chain_depth + 1,
        consistency_score=root_consistency,
        discrepancies=root_discrepancies,
    )
    db.add(new_app)
    parent_app.status = "submitted_up"
    parent_app.status_updated_at = datetime.utcnow()
    await db.commit()
    folder_name = None
    if target_folder_id:
        fld_r = await db.execute(select(Folder).where(Folder.id == target_folder_id))
        fld = fld_r.scalar_one_or_none()
        folder_name = fld.name if fld else None
    return {
        "message": "Submitted to next tier",
        "new_application_id": new_app.id,
        "placed_in_folder": folder_name or "(no matching folder found — check recipient email)",
    }

# ── Genealogy chain ───────────────────────────────────────────────────────────
@router.get("/{app_id}/genealogy")
async def get_genealogy(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Build the full submission chain by walking both UP (ancestors) and DOWN (descendants)."""
    # Step 1: Walk UP to find the root application (depth-0)
    root_id = app_id
    check_id = app_id
    seen_up = {app_id}
    while True:
        up_r = await db.execute(select(Application).where(Application.id == check_id))
        up_app = up_r.scalar_one_or_none()
        if not up_app or not up_app.parent_application_id or up_app.parent_application_id in seen_up:
            break
        seen_up.add(up_app.parent_application_id)
        root_id = up_app.parent_application_id
        check_id = up_app.parent_application_id

    # Step 2: Walk DOWN from root to collect all descendants in order
    all_apps = []
    queue = [root_id]
    visited = set()
    while queue:
        current_id = queue.pop(0)
        if current_id in visited:
            continue
        visited.add(current_id)
        app_r = await db.execute(select(Application).where(Application.id == current_id))
        app = app_r.scalar_one_or_none()
        if not app:
            continue
        all_apps.append(app)
        # Find children
        children_r = await db.execute(
            select(Application).where(Application.parent_application_id == current_id)
        )
        for child in children_r.scalars().all():
            if child.id not in visited:
                queue.append(child.id)

    all_apps.sort(key=lambda x: x.chain_depth)

    # Step 3: Build chain entries
    chain = []
    for app in all_apps:
        # org_name = the org that OWNS/RECEIVED this application (folder owner)
        # This is used by the frontend to identify "which tier am I" for each entity
        org_name = None
        if app.folder_id:
            fld_r = await db.execute(select(Folder).where(Folder.id == app.folder_id))
            fld = fld_r.scalar_one_or_none()
            if fld and fld.org_id:
                forg_r = await db.execute(select(Organization).where(Organization.id == fld.org_id))
                forg = forg_r.scalar_one_or_none()
                if forg: org_name = forg.name

        # submitted_by_org = who sent this application (for display)
        submitted_by_org_name = None
        if app.submitted_by_org_id:
            sorg_r = await db.execute(select(Organization).where(Organization.id == app.submitted_by_org_id))
            sorg = sorg_r.scalar_one_or_none()
            if sorg: submitted_by_org_name = sorg.name

        # Candidate name
        cand_name = None
        if app.candidate_id:
            cand_r = await db.execute(select(User).where(User.id == app.candidate_id))
            cand = cand_r.scalar_one_or_none()
            if cand: cand_name = f"{cand.first_name} {cand.last_name}".strip()

        # Next org = the org that RECEIVED the child application
        # Check regardless of status — a child may exist even if status wasn't updated
        next_org_name = None
        if True:  # always check for child
            child_r = await db.execute(
                select(Application).where(Application.parent_application_id == app.id)
            )
            child = child_r.scalar_one_or_none()
            if child:
                if child.folder_id:
                    cf_r = await db.execute(select(Folder).where(Folder.id == child.folder_id))
                    cf = cf_r.scalar_one_or_none()
                    if cf and cf.org_id:
                        no_r = await db.execute(select(Organization).where(Organization.id == cf.org_id))
                        no = no_r.scalar_one_or_none()
                        if no: next_org_name = no.name
                elif child.submitted_by_org_id:
                    # fallback: use the child's submitted_by org (the sender at next level)
                    pass

        chain.append({
            "application_id": app.id,
            "chain_depth": app.chain_depth,
            "org_name": org_name,              # folder owner = RECEIVING org at this tier
            "submitted_by": submitted_by_org_name,  # who sent it
            "candidate_name": cand_name,
            "next_org_name": next_org_name,
            "flow_type": app.flow_type,
            "status": app.status,
            "received_at": app.received_at.isoformat(),
        })

    return chain


# ── Download resume for an application ───────────────────────────────────────
from fastapi.responses import FileResponse
import os

@router.get("/{app_id}/resume")
async def download_resume(
    app_id: str,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """Download the candidate resume for a given application."""
    from app.models.models import Resume, ApplicantProfile
    r = await db.execute(select(Application).where(Application.id == app_id))
    app = r.scalar_one_or_none()
    if not app: raise HTTPException(404, "Application not found")

    prof_r = await db.execute(select(ApplicantProfile).where(ApplicantProfile.user_id == app.candidate_id))
    profile = prof_r.scalar_one_or_none()
    if not profile: raise HTTPException(404, "Profile not found")

    res_r = await db.execute(select(Resume).where(Resume.profile_id == profile.id, Resume.is_current == True))
    resume = res_r.scalar_one_or_none()
    if not resume: raise HTTPException(404, "No resume found for this candidate")

    # Extract filename from file_url  e.g. "/resumes/profileid_v1.pdf"
    url_parts = (resume.file_url or "").split("/")
    filename = url_parts[-1] if url_parts else ""
    file_path = f"/app/resumes/{filename}"

    if not os.path.exists(file_path):
        raise HTTPException(404, f"Resume file not found on server")

    return FileResponse(
        path=file_path,
        filename=resume.original_filename,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={resume.original_filename}"}
    )


# ── View HM discrepancy report for an application (employer-accessible) ────────
@router.get("/{app_id}/hm-report")
async def view_hm_report(
    app_id: str,
    download: bool = False,
    current_user: User = Depends(EMPLOYER_ONLY),
    db: AsyncSession = Depends(get_db)
):
    """Serve the HM discrepancy report PDF to the employer for a sent application."""
    # Verify the application belongs to a folder owned by this employer's org
    r = await db.execute(select(Application).where(Application.id == app_id))
    app = r.scalar_one_or_none()
    if not app: raise HTTPException(404, "Application not found")

    folder_r = await db.execute(select(Folder).where(Folder.id == app.folder_id))
    folder = folder_r.scalar_one_or_none()
    if not folder or folder.org_id != current_user.org_id:
        raise HTTPException(403, "Access denied")

    # Walk parent chain to find root app with HM review
    root_app_id = app_id
    check = app
    seen = {app.id}
    while check.parent_application_id and check.parent_application_id not in seen:
        seen.add(check.parent_application_id)
        pr = await db.execute(select(Application).where(Application.id == check.parent_application_id))
        p = pr.scalar_one_or_none()
        if not p: break
        root_app_id = p.id
        check = p

    rev_r = await db.execute(
        select(SubmissionReview).where(
            SubmissionReview.application_id == root_app_id,
            SubmissionReview.archived == True
        )
    )
    rev = rev_r.scalar_one_or_none()
    if not rev or not rev.discrepancy_report_filename:
        raise HTTPException(404, "No discrepancy report available for this application")

    file_path = f"/app/reports/{rev.id}_report.pdf"
    if not os.path.exists(file_path):
        raise HTTPException(404, "Report file not found on server")

    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=file_path,
        filename=rev.discrepancy_report_filename,
        media_type="application/pdf",
        headers={"Content-Disposition": f"{disposition}; filename={rev.discrepancy_report_filename}"}
    )

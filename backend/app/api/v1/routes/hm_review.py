"""
HM Internal Review Lifecycle — Active & Archived Requests
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import os, shutil

from app.db.session import get_db
from app.models.models import (
    User, SubmissionReview, Application, Folder, ApplicantProfile, Resume, ShareToken
)
from app.core.dependencies import require_roles

router = APIRouter()
HM_ONLY = require_roles(["hm_super_admin", "hm_admin"])
REPORT_DIR = "/app/reports"

STATUS_VALUES = [
    "awaiting_review", "review_in_progress", "pending_qa", "on_hold", "ready_to_send"
]

DISPOSITION_COLORS = {"green": "green", "yellow": "yellow", "red": "red"}


async def review_to_dict(rev: SubmissionReview, db: AsyncSession) -> dict:
    cand_r = await db.execute(select(User).where(User.id == rev.candidate_id))
    cand = cand_r.scalar_one_or_none()
    folder_r = await db.execute(select(Folder).where(Folder.id == rev.folder_id))
    folder = folder_r.scalar_one_or_none()
    return {
        "id": rev.id,
        "application_id": rev.application_id,
        "candidate_name": f"{cand.first_name} {cand.last_name}" if cand else "Unknown",
        "candidate_email": cand.email if cand else None,
        "job_id": folder.name if folder else None,
        "job_title": folder.position_title if folder else None,
        "date_submitted": rev.created_at.isoformat() if rev.created_at else None,
        "status": rev.status,
        "discrepancy_report_url": rev.discrepancy_report_url,
        "discrepancy_report_filename": rev.discrepancy_report_filename,
        "disposition_flag": rev.disposition_flag,
        "comments": rev.comments,
        "archived": rev.archived,
        "sent_at": rev.sent_at.isoformat() if rev.sent_at else None,
    }


@router.get("/active-requests")
async def get_active_requests(
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(
        select(SubmissionReview).where(SubmissionReview.archived == False)
        .order_by(SubmissionReview.created_at.desc())
    )
    reviews = r.scalars().all()
    return [await review_to_dict(rev, db) for rev in reviews]


@router.get("/archived-requests")
async def get_archived_requests(
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(
        select(SubmissionReview).where(SubmissionReview.archived == True)
        .order_by(SubmissionReview.sent_at.desc())
    )
    reviews = r.scalars().all()
    return [await review_to_dict(rev, db) for rev in reviews]


class StatusUpdate(BaseModel):
    status: str

@router.patch("/requests/{review_id}/status")
async def update_status(
    review_id: str, data: StatusUpdate,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(SubmissionReview).where(SubmissionReview.id == review_id))
    rev = r.scalar_one_or_none()
    if not rev: raise HTTPException(404, "Review not found")
    if data.status not in STATUS_VALUES:
        raise HTTPException(400, f"Invalid status. Must be one of: {STATUS_VALUES}")
    rev.status = data.status
    await db.commit()
    return {"message": "Status updated"}


@router.post("/requests/{review_id}/upload-report")
async def upload_report(
    review_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(SubmissionReview).where(SubmissionReview.id == review_id))
    rev = r.scalar_one_or_none()
    if not rev: raise HTTPException(404, "Review not found")

    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Only PDF files accepted")

    os.makedirs(REPORT_DIR, exist_ok=True)
    stored_name = f"{review_id}_report.pdf"
    stored_path = os.path.join(REPORT_DIR, stored_name)
    with open(stored_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    rev.discrepancy_report_url = f"/api/v1/hm/requests/{review_id}/report"
    rev.discrepancy_report_filename = file.filename
    await db.commit()
    return {"message": "Report uploaded", "filename": file.filename}


class DispositionUpdate(BaseModel):
    disposition_flag: str
    comments: Optional[str] = None

@router.patch("/requests/{review_id}/disposition")
async def update_disposition(
    review_id: str, data: DispositionUpdate,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(SubmissionReview).where(SubmissionReview.id == review_id))
    rev = r.scalar_one_or_none()
    if not rev: raise HTTPException(404, "Review not found")
    if data.disposition_flag not in DISPOSITION_COLORS:
        raise HTTPException(400, "Flag must be green, yellow, or red")
    rev.disposition_flag = data.disposition_flag
    rev.comments = data.comments
    await db.commit()
    return {"message": "Disposition updated"}


@router.post("/requests/{review_id}/send")
async def send_to_recipient(
    review_id: str,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(SubmissionReview).where(SubmissionReview.id == review_id))
    rev = r.scalar_one_or_none()
    if not rev: raise HTTPException(404, "Review not found")

    # Validate all 3 conditions
    errors = []
    if rev.status != "ready_to_send":
        errors.append("Status must be 'Ready to send'")
    if not rev.discrepancy_report_url:
        errors.append("Discrepancy report must be uploaded")
    if not rev.disposition_flag:
        errors.append("Disposition flag must be set")
    if errors:
        raise HTTPException(400, "; ".join(errors))

    # Freeze submission — update application consistency score from disposition flag
    if rev.application_id:
        app_r = await db.execute(select(Application).where(Application.id == rev.application_id))
        app = app_r.scalar_one_or_none()
        if app:
            app.consistency_score = rev.disposition_flag

    # Archive the review
    rev.archived = True
    rev.sent_at = datetime.utcnow()
    rev.sent_by = current_user.id
    await db.commit()
    return {"message": "Submission sent to recipient", "submission_id": rev.id}


@router.post("/requests/{review_id}/reactivate")
async def reactivate(
    review_id: str,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(SubmissionReview).where(SubmissionReview.id == review_id))
    rev = r.scalar_one_or_none()
    if not rev or not rev.archived:
        raise HTTPException(404, "Archived review not found")
    rev.archived = False
    rev.sent_at = None
    rev.sent_by = None
    rev.status = "awaiting_review"
    await db.commit()
    return {"message": "Moved back to Active Requests"}


@router.get("/requests/{review_id}/report")
async def view_report(
    review_id: str,
    download: bool = False,
    current_user: User = Depends(HM_ONLY),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(SubmissionReview).where(SubmissionReview.id == review_id))
    rev = r.scalar_one_or_none()
    if not rev or not rev.discrepancy_report_filename:
        raise HTTPException(404, "Report not found")
    file_path = os.path.join(REPORT_DIR, f"{review_id}_report.pdf")
    if not os.path.exists(file_path):
        raise HTTPException(404, "Report file not found on server")
    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=file_path,
        filename=rev.discrepancy_report_filename,
        media_type="application/pdf",
        headers={"Content-Disposition": f"{disposition}; filename={rev.discrepancy_report_filename}"}
    )


# Queue new submission for review (called when candidate submits)
@router.post("/queue-submission")
async def queue_submission(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Internal endpoint — called when a candidate submission is confirmed."""
    review = SubmissionReview(
        application_id=data.get("application_id"),
        candidate_id=data["candidate_id"],
        folder_id=data.get("folder_id"),
        status="awaiting_review",
    )
    db.add(review)
    await db.commit()
    return {"review_id": review.id}

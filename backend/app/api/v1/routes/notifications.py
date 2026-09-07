"""Notification routes — create, list, read, delete, broadcast."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import User, Notification, UserNotification, UserRole
from app.core.dependencies import get_current_user, require_roles

router = APIRouter()
HM_SUPER = require_roles([UserRole.HM_SUPER_ADMIN, UserRole.HM_ADMIN])

class CreateNotificationRequest(BaseModel):
    title: str
    body: str
    notification_type: str  # system_alert | platform_update | action_required | informational
    target_role: Optional[str] = None
    target_user_id: Optional[str] = None

async def deliver_notification(notification: Notification, db: AsyncSession):
    """Fan out notification to targeted users."""
    if notification.target_user_id:
        delivery = UserNotification(notification_id=notification.id, user_id=notification.target_user_id)
        db.add(delivery)
    elif notification.target_role:
        users_r = await db.execute(select(User).where(User.role == notification.target_role, User.status == "active"))
        for user in users_r.scalars().all():
            db.add(UserNotification(notification_id=notification.id, user_id=user.id))
    else:
        # Broadcast to all active users
        users_r = await db.execute(select(User).where(User.status == "active"))
        for user in users_r.scalars().all():
            db.add(UserNotification(notification_id=notification.id, user_id=user.id))


@router.post("/", status_code=201)
async def create_notification(
    data: CreateNotificationRequest,
    current_user: User = Depends(HM_SUPER),
    db: AsyncSession = Depends(get_db)
):
    notification = Notification(
        title=data.title, body=data.body,
        notification_type=data.notification_type,
        target_role=data.target_role,
        target_user_id=data.target_user_id,
        created_by=current_user.id,
        is_system_generated=False,
    )
    db.add(notification)
    await db.flush()
    await deliver_notification(notification, db)
    await db.commit()
    return {"message": "Notification sent", "id": notification.id}


async def create_system_notification(
    title: str, body: str, notification_type: str,
    target_user_id: str, trigger_event: str, db: AsyncSession
):
    """Create system-generated notification for a specific user."""
    notification = Notification(
        title=title, body=body,
        notification_type=notification_type,
        target_user_id=target_user_id,
        is_system_generated=True,
        trigger_event=trigger_event,
    )
    db.add(notification)
    await db.flush()
    delivery = UserNotification(notification_id=notification.id, user_id=target_user_id)
    db.add(delivery)


@router.get("/")
async def list_my_notifications(
    unread_only: bool = False,
    notification_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (select(UserNotification, Notification)
             .join(Notification, UserNotification.notification_id == Notification.id)
             .where(
                 UserNotification.user_id == current_user.id,
                 UserNotification.is_deleted == False,
                 Notification.created_by != current_user.id,  # Don't show self-sent notifications
             ))
    if unread_only:
        query = query.where(UserNotification.is_read == False)
    if notification_type:
        query = query.where(Notification.notification_type == notification_type)
    query = query.order_by(Notification.created_at.desc())
    r = await db.execute(query)
    results = []
    for un, notif in r.all():
        results.append({
            "id": un.id, "notification_id": notif.id,
            "title": notif.title, "body": notif.body,
            "notification_type": notif.notification_type,
            "is_read": un.is_read, "is_system_generated": notif.is_system_generated,
            "created_at": notif.created_at.isoformat(),
            "read_at": un.read_at.isoformat() if un.read_at else None,
        })
    return results


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Join to Notification to exclude ones created by this user (HM Admin is origin not destination)
    r = await db.execute(
        select(UserNotification).join(Notification, UserNotification.notification_id == Notification.id)
        .where(
            UserNotification.user_id == current_user.id,
            UserNotification.is_read == False,
            UserNotification.is_deleted == False,
            Notification.created_by != current_user.id,
        )
    )
    return {"unread_count": len(r.scalars().all())}


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(UserNotification).where(
        UserNotification.id == notification_id, UserNotification.user_id == current_user.id))
    un = r.scalar_one_or_none()
    if not un: raise HTTPException(404, "Notification not found")
    un.is_read = True
    un.read_at = datetime.utcnow()
    await db.commit()
    return {"message": "Marked as read"}


@router.patch("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(UserNotification).where(
        UserNotification.user_id == current_user.id, UserNotification.is_read == False))
    count = 0
    for un in r.scalars().all():
        un.is_read = True
        un.read_at = datetime.utcnow()
        count += 1
    await db.commit()
    return {"message": f"Marked {count} notifications as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(select(UserNotification).where(
        UserNotification.id == notification_id, UserNotification.user_id == current_user.id))
    un = r.scalar_one_or_none()
    if not un: raise HTTPException(404, "Notification not found")
    un.is_deleted = True
    un.deleted_at = datetime.utcnow()
    await db.commit()
    return {"message": "Notification deleted"}

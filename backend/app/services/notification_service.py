"""
Notification service — creates Notification + UserNotification records.
Called from routes whenever a system event occurs.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Notification, UserNotification, User


async def create_notification(
    db: AsyncSession,
    title: str,
    body: str,
    notification_type: str = "informational",
    target_role: str | None = None,
    target_user_id: str | None = None,
    created_by: str | None = None,
    trigger_event: str | None = None,
) -> Notification:
    """Create a notification and fan out UserNotification rows to matching users."""
    notif = Notification(
        title=title,
        body=body,
        notification_type=notification_type,
        target_role=target_role,
        target_user_id=target_user_id,
        created_by=created_by,
        is_system_generated=(created_by is None),
        trigger_event=trigger_event,
    )
    db.add(notif)
    await db.flush()   # get notif.id without committing

    if target_user_id:
        result = await db.execute(select(User).where(User.id == target_user_id, User.status == "active"))
        users = [result.scalar_one_or_none()]
        users = [u for u in users if u]
    elif target_role:
        result = await db.execute(select(User).where(User.role == target_role, User.status == "active"))
        users = list(result.scalars().all())
    else:
        # broadcast — all active users
        result = await db.execute(select(User).where(User.status == "active"))
        users = list(result.scalars().all())

    for u in users:
        db.add(UserNotification(notification_id=notif.id, user_id=u.id))

    return notif


async def notify_user(
    db: AsyncSession,
    user_id: str,
    title: str,
    body: str,
    notification_type: str = "informational",
    trigger_event: str | None = None,
) -> None:
    """Convenience wrapper for single-user notifications."""
    await create_notification(
        db=db, title=title, body=body, notification_type=notification_type,
        target_user_id=user_id, trigger_event=trigger_event,
    )

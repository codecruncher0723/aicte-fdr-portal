"""
Notifications API Router (/api/v1/notifications).
Implements Section 8.7 of REQUIREMENTS_UPDATED.md with strict owner authorization.
"""

from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.enums import UserRole
from app.models.notification import Notification
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


class NotificationPatchRequest(BaseModel):
    is_read: bool


@router.get("", summary="Get notifications for the current authenticated user")
def list_notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns notifications addressed to the current user, their role, or their institution.
    """
    query = session.query(Notification)

    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        query = query.filter(
            (Notification.recipient_user_id == current_user.id)
            | (Notification.institution_id == current_user.institution_id)
        )
    elif current_user.role == UserRole.AICTE_ADMIN.value:
        query = query.filter(
            (Notification.recipient_user_id == current_user.id)
            | (Notification.recipient_role == UserRole.AICTE_ADMIN.value)
        )
    else:
        query = query.filter(
            (Notification.recipient_user_id == current_user.id)
            | (Notification.recipient_role == current_user.role)
        )

    notifs = query.order_by(desc(Notification.created_at)).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]


@router.patch("/{notification_id}", summary="Mark notification read or unread")
def update_notification(
    notification_id: int,
    req: NotificationPatchRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Updates is_read status. Enforces owner authorization:
    Users cannot modify notifications intended for other users or institutions.
    """
    notif = session.query(Notification).filter_by(id=notification_id).first()
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} not found.",
        )

    # Ownership check
    if notif.recipient_user_id and notif.recipient_user_id != current_user.id:
        if current_user.role == UserRole.INSTITUTION_OFFICER.value:
            if notif.institution_id != current_user.institution_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot modify notification belonging to another recipient.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify notification belonging to another recipient.",
            )

    notif.is_read = req.is_read
    session.commit()
    return {"id": notif.id, "is_read": notif.is_read}

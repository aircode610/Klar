"""Action item CRUD + user-correction feedback loop (auth-required)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.auth.dependencies import get_current_user
from app.database import get_session
from app.models import ActionItem, ActionStatus, Letter, User, UserCorrection
from app.schemas import ActionUpdate

router = APIRouter(prefix="/api/actions", tags=["actions"])


def _own_action(db: Session, action_id: UUID, user: User) -> ActionItem:
    item = db.get(ActionItem, action_id)
    if item is None:
        raise HTTPException(404, "Action not found")
    letter = db.get(Letter, item.letter_id)
    if letter is None or letter.user_id != user.id:
        raise HTTPException(404, "Action not found")
    return item


@router.get("")
def list_actions(
    status: ActionStatus | None = Query(default=None),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(ActionItem)
        .join(Letter, Letter.id == ActionItem.letter_id)
        .where(Letter.user_id == user.id)
    )
    if status:
        stmt = stmt.where(ActionItem.status == status)
    items = list(db.scalars(stmt).all())
    return [
        {
            "id": str(a.id),
            "letter_id": str(a.letter_id),
            "title": a.title,
            "deadline": a.deadline.isoformat() if a.deadline else None,
            "severity": a.severity.value,
            "status": a.status.value,
            "reply_needed": a.reply_needed,
        }
        for a in items
    ]


@router.patch("/{action_id}")
def update_action(
    action_id: UUID,
    payload: ActionUpdate,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    item = _own_action(db, action_id, user)

    changes = payload.model_dump(exclude_unset=True)
    for field, new_value in changes.items():
        old_value = getattr(item, field)
        if old_value != new_value:
            db.add(
                UserCorrection(
                    action_item_id=action_id,
                    field_name=field,
                    original_value=str(old_value),
                    corrected_value=str(new_value),
                )
            )
            setattr(item, field, new_value)

    db.add(item)
    db.commit()
    return {"id": str(item.id), "status": item.status.value}

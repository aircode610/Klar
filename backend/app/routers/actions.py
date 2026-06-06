"""Action item CRUD + user-correction feedback loop."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import ActionItem, ActionStatus, UserCorrection
from app.schemas import ActionUpdate

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("")
def list_actions(
    status: ActionStatus | None = Query(default=None),
    session: Session = Depends(get_session),
):
    stmt = select(ActionItem)
    if status:
        stmt = stmt.where(ActionItem.status == status)
    items = list(session.scalars(stmt).all())
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
    session: Session = Depends(get_session),
):
    item = session.get(ActionItem, action_id)
    if not item:
        raise HTTPException(404, "Action not found")

    changes = payload.model_dump(exclude_unset=True)
    for field, new_value in changes.items():
        old_value = getattr(item, field)
        if old_value != new_value:
            session.add(
                UserCorrection(
                    action_item_id=action_id,
                    field_name=field,
                    original_value=str(old_value),
                    corrected_value=str(new_value),
                )
            )
            setattr(item, field, new_value)

    session.add(item)
    session.commit()
    return {"id": str(item.id), "status": item.status.value}

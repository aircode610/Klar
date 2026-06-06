"""Letter upload + retrieval endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from app.database import get_session
from app.models import ActionItem, Letter, RiskScore
from app.schemas import LetterResponse
from app.services.extraction import extract_from_image
from app.services.risk import compute_risk

router = APIRouter(prefix="/letters", tags=["letters"])


@router.post("", response_model=LetterResponse)
async def upload_letter(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    if not file.content_type or not file.content_type.startswith(("image/", "application/pdf")):
        raise HTTPException(400, "Only image or PDF files are accepted")

    image_bytes = await file.read()
    extracted = await extract_from_image(image_bytes, mime=file.content_type)

    letter = Letter(
        institution=extracted.institution,
        document_type=extracted.document_type,
        category=extracted.category,
        summary_en=extracted.summary_en,
        extraction_warnings=extracted.extraction_warnings,
    )
    session.add(letter)
    session.flush()

    saved_actions: list[dict] = []
    for a in extracted.actions:
        item = ActionItem(
            letter_id=letter.id,
            title=a.title,
            description=a.description,
            steps=a.steps,
            deadline=a.deadline_iso,
            deadline_confidence=a.deadline_confidence,
            deadline_source=a.deadline_source,
            severity=a.severity,
            reply_needed=a.reply_needed,
            evidence_span=a.evidence_span,
        )
        session.add(item)
        session.flush()

        score = compute_risk(item, institution=extracted.institution)
        session.add(RiskScore(action_item_id=item.id, **score))
        saved_actions.append(
            {
                "id": str(item.id),
                "title": item.title,
                "deadline": item.deadline.isoformat() if item.deadline else None,
                "severity": item.severity.value,
                "risk_score": score["score"],
                "steps": item.steps,
                "evidence_span": item.evidence_span,
                "reply_needed": item.reply_needed,
            }
        )

    session.commit()
    session.refresh(letter)

    return LetterResponse(
        id=letter.id,
        institution=letter.institution,
        document_type=letter.document_type,
        category=letter.category,
        summary_en=letter.summary_en,
        actions=saved_actions,
        extraction_warnings=letter.extraction_warnings,
    )


@router.get("/{letter_id}", response_model=LetterResponse)
def get_letter(letter_id: UUID, session: Session = Depends(get_session)):
    letter = session.get(Letter, letter_id)
    if not letter:
        raise HTTPException(404, "Letter not found")
    stmt = select(ActionItem).where(ActionItem.letter_id == letter_id)
    actions = list(session.scalars(stmt).all())
    return LetterResponse(
        id=letter.id,
        institution=letter.institution,
        document_type=letter.document_type,
        category=letter.category,
        summary_en=letter.summary_en,
        actions=[
            {
                "id": str(a.id),
                "title": a.title,
                "deadline": a.deadline.isoformat() if a.deadline else None,
                "severity": a.severity.value,
                "status": a.status.value,
                "steps": a.steps,
                "evidence_span": a.evidence_span,
            }
            for a in actions
        ],
        extraction_warnings=letter.extraction_warnings,
    )

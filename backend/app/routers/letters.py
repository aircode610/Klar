"""Letter upload + retrieval endpoints (auth-required, /api/letters/*)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.auth.dependencies import get_current_user
from app.database import get_session
from app.models import (
    ActionItem,
    DocumentCategory,
    Letter,
    LetterStatus,
    User,
    utcnow,
)
from app.schemas import LetterListItem, LetterResponse, LetterUploadResponse
from app.services.extraction import extract_from_letter_file, normalize_lang
from app.services.persistence import persist_extraction
from app.services.storage import detect_magic_mime, save_letter_file

router = APIRouter(prefix="/api/letters", tags=["letters"])

ACCEPTED_MIMES = {
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/webp",
    "application/pdf",
}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB per spec


# --- helpers --------------------------------------------------------------


def _letter_response(letter: Letter, actions: list[ActionItem]) -> LetterResponse:
    return LetterResponse(
        id=letter.id,
        institution=letter.institution,
        document_type=letter.document_type,
        letter_type=letter.letter_type or letter.document_type,
        category=letter.category,
        summary=letter.summary,
        language=letter.language,
        risk_score=letter.risk_score,
        deadline_date=letter.deadline_date,
        explanation=letter.explanation,
        response_draft=letter.response_draft,
        checklist=letter.checklist,
        citations=letter.citations,
        consequence=letter.consequence,
        status=letter.status,
        processed_at=letter.processed_at,
        created_at=letter.created_at,
        actions=[
            {
                "id": str(a.id),
                "title": a.title,
                "description": a.description,
                "deadline": a.deadline.isoformat() if a.deadline else None,
                "deadline_source": a.deadline_source.value,
                "deadline_confidence": a.deadline_confidence,
                "severity": a.severity.value,
                "status": a.status.value,
                "steps": a.steps,
                "reply_needed": a.reply_needed,
                "evidence_span": a.evidence_span,
            }
            for a in actions
        ],
        extraction_warnings=letter.extraction_warnings,
    )


# --- POST /api/letters/upload --------------------------------------------


@router.post("/upload", response_model=LetterUploadResponse, status_code=201)
async def upload_letter(
    file: UploadFile = File(...),
    lang: str | None = Query(default=None, max_length=8),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Save the upload, create a Letter row with status='uploaded', return its id.

    Extraction runs LATER via GET /api/letters/{id}/process (SSE).

    Validation:
    - Declared Content-Type must be in ACCEPTED_MIMES.
    - File MUST match its declared type via magic-bytes inspection — defends
      against malicious renames (e.g. an executable announced as image/jpeg).
    - 10 MB max size per spec.
    """
    if not file.content_type or file.content_type not in ACCEPTED_MIMES:
        raise HTTPException(415, "Unsupported file type")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(400, "Empty file")
    if len(image_bytes) > MAX_FILE_BYTES:
        raise HTTPException(413, "File exceeds 10MB limit")

    actual_mime = detect_magic_mime(image_bytes)
    if actual_mime is None:
        raise HTTPException(415, "Unrecognized file content")
    # Allow image/jpeg ↔ image/jpg variants; otherwise demand strict match.
    if actual_mime != file.content_type and not (
        actual_mime.startswith("image/") and file.content_type.startswith("image/")
        and actual_mime.split("/")[-1] == file.content_type.split("/")[-1]
    ):
        raise HTTPException(
            415,
            f"Declared {file.content_type} but content looks like {actual_mime}",
        )

    out_lang = normalize_lang(lang or user.language)

    letter = Letter(
        user_id=user.id,
        language=out_lang,
        status=LetterStatus.UPLOADED,
    )
    db.add(letter)
    db.flush()  # need letter.id for filename

    saved_path = save_letter_file(user.id, letter.id, actual_mime, image_bytes)
    letter.original_file = saved_path
    db.add(letter)
    db.commit()
    db.refresh(letter)

    return LetterUploadResponse(letter_id=letter.id)


# --- POST /api/letters/{id}/extract (non-streaming convenience) ----------


@router.post("/{letter_id}/extract", response_model=LetterResponse)
async def extract_letter(
    letter_id: UUID,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Synchronous extraction — runs the structured Qwen call inline and
    returns the populated LetterResponse. Used by clients that don't want SSE.

    Long-form fields (explanation, response_draft, checklist, citations) are
    NOT populated here — only the SSE endpoint generates those.
    """
    letter = db.get(Letter, letter_id)
    if letter is None or letter.user_id != user.id:
        raise HTTPException(404, "Letter not found")

    if not letter.original_file:
        raise HTTPException(409, "Letter has no file on disk")

    letter.status = LetterStatus.PROCESSING
    db.add(letter)
    db.commit()

    try:
        mime = (
            "application/pdf"
            if letter.original_file.lower().endswith(".pdf")
            else "image/jpeg"
        )
        extracted = await extract_from_letter_file(
            letter.original_file, mime, lang=letter.language
        )
    except Exception as e:
        letter.status = LetterStatus.ERROR
        db.add(letter)
        db.commit()
        raise HTTPException(500, f"Extraction failed: {e}")

    actions = persist_extraction(db, letter, extracted)
    letter.status = LetterStatus.COMPLETED
    letter.processed_at = utcnow()
    db.add(letter)
    db.commit()
    db.refresh(letter)

    return _letter_response(letter, actions)


# --- GET /api/letters ----------------------------------------------------


@router.get("", response_model=list[LetterListItem])
def list_letters(
    status: LetterStatus | None = Query(default=None),
    category: DocumentCategory | None = Query(default=None),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Letter).where(Letter.user_id == user.id)
    if status:
        stmt = stmt.where(Letter.status == status)
    if category:
        stmt = stmt.where(Letter.category == category)
    stmt = stmt.order_by(Letter.created_at.desc())
    items = list(db.scalars(stmt).all())
    return [
        LetterListItem(
            id=letter.id,
            letter_type=letter.letter_type or letter.document_type,
            category=letter.category,
            risk_score=letter.risk_score,
            deadline_date=letter.deadline_date,
            status=letter.status,
            created_at=letter.created_at,
        )
        for letter in items
    ]


# --- GET /api/letters/{id}/process (SSE) ---------------------------------


@router.get("/{letter_id}/process")
async def process_letter(
    letter_id: UUID,
    lang: str | None = Query(default=None, max_length=8),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """SSE stream: orchestrates extraction + long-form generation.

    Auth is via the session cookie (set by /api/auth/login). EventSource
    callers must construct with `withCredentials: true` so the cookie travels
    on the SSE GET. The spec's `?token=` query-param is intentionally NOT
    supported — tokens-in-URL get logged to access logs and browser history.
    See docs/02-backend.md "Modifications" section.

    NOTE: we do NOT pass the injected `db` to the generator — FastAPI closes
    it as soon as this handler returns. The generator opens and owns its own
    Session for the stream's lifetime.
    """
    letter = db.get(Letter, letter_id)
    if letter is None or letter.user_id != user.id:
        raise HTTPException(404, "Letter not found")

    out_lang = normalize_lang(lang or letter.language or user.language)

    # Import here, not at module top, so pipeline can freely import from
    # routers (no cycle, since orchestrator only depends on services/).
    from app.pipeline.orchestrator import process_letter_stream

    return StreamingResponse(
        process_letter_stream(letter_id, out_lang),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# --- GET /api/letters/{id} ------------------------------------------------


@router.get("/{letter_id}", response_model=LetterResponse)
def get_letter(
    letter_id: UUID,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    letter = db.get(Letter, letter_id)
    if letter is None or letter.user_id != user.id:
        raise HTTPException(404, "Letter not found")
    actions = list(
        db.scalars(select(ActionItem).where(ActionItem.letter_id == letter_id)).all()
    )
    return _letter_response(letter, actions)

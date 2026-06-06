"""Frontend-facing adapter routes — root-level (no /api prefix).

The frontend team's contract (`docs/06-frontend-integration-contract.md`)
expects:

    POST   /letters?lang=        — synchronous upload + extract, returns full Letter
    GET    /letters/{id}?lang=   — returns full Letter
    GET    /actions?lang=&status= — returns ActionListItem[]
    PATCH  /actions/{id}         — returns {id, status}
    POST   /rag/search           — returns {hits: RagHit[]}
    GET    /health               — already at root, no change

This module mounts those five routes at root. Each route is auth-required via
the session cookie (frontend bootstraps once via /auth/signup; see docs/
06-api-contract.md → "Frontend auth bootstrap"). All routes delegate to the
existing services in app/services/* — no duplicated extraction or persistence
logic.

The `/api/*` routes (auth, /api/letters, /api/actions, /api/deadlines,
/api/rag) are unchanged and continue to serve clients that want the richer
shapes / SSE streaming.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlmodel import Session, select

from app.auth.dependencies import get_current_user
from app.database import get_session
from app.errors import ErrorCode, KlarHTTPException
from app.models import (
    ActionItem,
    ActionStatus,
    Letter,
    LetterStatus,
    RiskScore,
    User,
    utcnow,
)
from app.schemas import (
    ActionUpdate,
    ErrorResponse,
    PublicAction,
    PublicActionListItem,
    PublicActionUpdateResponse,
    PublicLetter,
    RagHit,
    RagQuery,
    RagResponse,
)
from app.services.extraction import extract_from_letter_file, normalize_lang
from app.services.persistence import persist_extraction
from app.services.storage import detect_magic_mime, save_letter_file
from app.rag import store

router = APIRouter(tags=["public"])

ACCEPTED_MIMES = {
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/webp",
    "application/pdf",
}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB per spec


# ---------- shape projection: Letter + ActionItems → PublicLetter ----------


def _public_action(
    action: ActionItem, latest_risk: int | None
) -> PublicAction:
    return PublicAction(
        id=str(action.id),
        title=action.title,
        description=action.description or None,
        deadline=action.deadline,
        severity=action.severity,
        risk_score=latest_risk,
        status=action.status,
        steps=action.steps or [],
        evidence_span=action.evidence_span or None,
        reply_needed=action.reply_needed,
    )


def _load_risk_by_action(
    db: Session, action_ids: list[UUID]
) -> dict[UUID, int]:
    """Batch-load the most recent RiskScore.score per action — O(1) queries."""
    if not action_ids:
        return {}
    stmt = (
        select(RiskScore)
        .where(RiskScore.action_item_id.in_(action_ids))
        .order_by(RiskScore.computed_at.desc())
    )
    out: dict[UUID, int] = {}
    for rs in db.scalars(stmt).all():
        # First-seen wins because of ORDER BY DESC.
        out.setdefault(rs.action_item_id, rs.score)
    return out


def _public_letter(db: Session, letter: Letter) -> PublicLetter:
    actions = list(
        db.scalars(
            select(ActionItem).where(ActionItem.letter_id == letter.id)
        ).all()
    )
    risk_by_action = _load_risk_by_action(db, [a.id for a in actions])
    return PublicLetter(
        id=str(letter.id),
        institution=letter.institution,
        document_type=letter.document_type,
        category=letter.category,
        summary_en=letter.summary,  # field renamed for frontend contract
        actions=[
            _public_action(a, risk_by_action.get(a.id))
            for a in actions
        ],
        extraction_warnings=letter.extraction_warnings or [],
    )


# ---------- POST /letters — synchronous upload + extract ----------


@router.post(
    "/letters",
    response_model=PublicLetter,
    status_code=200,
    summary="Upload a letter and return the full extraction (synchronous)",
    description=(
        "Frontend-facing root-level route. Combines `POST /api/letters/upload`"
        " + `POST /api/letters/{id}/extract` into one call: persists the file,"
        " runs the Qwen3.7-Plus vision + extraction call, persists the actions"
        " and risk scores, and returns the full PublicLetter inline.\n\n"
        "For streaming progress events use the richer SSE route "
        "`GET /api/letters/{id}/process` instead."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "`LETTER_EMPTY_UPLOAD`."},
        401: {"model": ErrorResponse, "description": "Not authenticated."},
        413: {"model": ErrorResponse, "description": "`LETTER_TOO_LARGE`."},
        415: {
            "model": ErrorResponse,
            "description": "`LETTER_UNSUPPORTED_TYPE` / `LETTER_CORRUPT_FILE` / `LETTER_MIME_MISMATCH`.",
        },
        502: {"model": ErrorResponse, "description": "`EXTRACTION_FAILED`."},
    },
)
async def post_letter(
    file: UploadFile = File(...),
    lang: str | None = Query(default=None, max_length=8),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not file.content_type or file.content_type not in ACCEPTED_MIMES:
        raise KlarHTTPException(415, ErrorCode.LETTER_UNSUPPORTED_TYPE)

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise KlarHTTPException(400, ErrorCode.LETTER_EMPTY_UPLOAD)
    if len(image_bytes) > MAX_FILE_BYTES:
        raise KlarHTTPException(413, ErrorCode.LETTER_TOO_LARGE)

    actual_mime = detect_magic_mime(image_bytes)
    if actual_mime is None:
        raise KlarHTTPException(415, ErrorCode.LETTER_CORRUPT_FILE)
    if actual_mime != file.content_type and not (
        actual_mime.startswith("image/")
        and file.content_type.startswith("image/")
        and actual_mime.split("/")[-1] == file.content_type.split("/")[-1]
    ):
        raise KlarHTTPException(
            415,
            ErrorCode.LETTER_MIME_MISMATCH,
            details={"declared": file.content_type, "detected": actual_mime},
        )

    out_lang = normalize_lang(lang or user.language)

    letter = Letter(
        user_id=user.id,
        language=out_lang,
        status=LetterStatus.UPLOADED,
    )
    db.add(letter)
    db.flush()

    saved_path = save_letter_file(user.id, letter.id, actual_mime, image_bytes)
    letter.original_file = saved_path
    letter.status = LetterStatus.PROCESSING
    db.add(letter)
    db.commit()

    try:
        extracted = await extract_from_letter_file(
            saved_path, actual_mime, lang=out_lang
        )
    except Exception:
        letter.status = LetterStatus.ERROR
        db.add(letter)
        db.commit()
        raise KlarHTTPException(502, ErrorCode.EXTRACTION_FAILED)

    persist_extraction(db, letter, extracted)
    letter.status = LetterStatus.COMPLETED
    letter.processed_at = utcnow()
    db.add(letter)
    db.commit()
    db.refresh(letter)

    return _public_letter(db, letter)


# ---------- GET /letters/{id} ----------


@router.get(
    "/letters/{letter_id}",
    response_model=PublicLetter,
    summary="Fetch a single letter in the frontend-facing shape",
    description=(
        "Frontend-facing root-level route. Returns the same `PublicLetter` "
        "as `POST /letters`. The `?lang=` parameter is accepted but does NOT "
        "re-extract — localization happens at extraction time. Re-localization "
        "support is a future enhancement."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated."},
        404: {"model": ErrorResponse, "description": "`LETTER_NOT_FOUND`."},
    },
)
def get_letter_public(
    letter_id: UUID,
    lang: str | None = Query(default=None, max_length=8),  # noqa: ARG001 — accepted for contract compat
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    letter = db.get(Letter, letter_id)
    if letter is None or letter.user_id != user.id:
        raise KlarHTTPException(404, ErrorCode.LETTER_NOT_FOUND)
    return _public_letter(db, letter)


# ---------- GET /actions ----------


@router.get(
    "/actions",
    response_model=list[PublicActionListItem],
    summary="List the current user's action items (home / deadlines / agenda feed)",
    description=(
        "Frontend-facing root-level route. Empty-string `?status=` is "
        "treated as 'no filter' — safe to bind directly to React state. "
        "Unknown values return `VALIDATION_ERROR`."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated."},
        422: {"model": ErrorResponse, "description": "Unknown status value."},
    },
)
def list_actions_public(
    status: str | None = Query(default=None),
    lang: str | None = Query(default=None, max_length=8),  # noqa: ARG001 — accepted for contract compat
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    parsed_status: ActionStatus | None = None
    if status:
        try:
            parsed_status = ActionStatus(status)
        except ValueError:
            raise KlarHTTPException(
                422,
                ErrorCode.VALIDATION_ERROR,
                message=f"Unknown status: {status!r}.",
                details={"errors": [{"field": "status", "message": "must be one of "
                                     + ", ".join(s.value for s in ActionStatus)}]},
            )

    stmt = (
        select(ActionItem)
        .join(Letter, Letter.id == ActionItem.letter_id)
        .where(Letter.user_id == user.id)
    )
    if parsed_status:
        stmt = stmt.where(ActionItem.status == parsed_status)
    items = list(db.scalars(stmt).all())
    return [
        PublicActionListItem(
            id=str(a.id),
            letter_id=str(a.letter_id),
            title=a.title,
            deadline=a.deadline,
            severity=a.severity,
            status=a.status,
            reply_needed=a.reply_needed,
        )
        for a in items
    ]


# ---------- PATCH /actions/{id} ----------


@router.patch(
    "/actions/{action_id}",
    response_model=PublicActionUpdateResponse,
    summary="Update an action (mark done / reopen / ignore)",
    description=(
        "Frontend-facing root-level route. Send only the fields you want to "
        "change. Each changed field is logged to `UserCorrection` server-side."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated."},
        404: {"model": ErrorResponse, "description": "`ACTION_NOT_FOUND`."},
    },
)
def update_action_public(
    action_id: UUID,
    payload: ActionUpdate,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    from app.models import UserCorrection

    item = db.get(ActionItem, action_id)
    if item is None:
        raise KlarHTTPException(404, ErrorCode.ACTION_NOT_FOUND)
    letter = db.get(Letter, item.letter_id)
    if letter is None or letter.user_id != user.id:
        raise KlarHTTPException(404, ErrorCode.ACTION_NOT_FOUND)

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
    return PublicActionUpdateResponse(id=str(item.id), status=item.status)


# ---------- POST /rag/search ----------


@router.post(
    "/rag/search",
    response_model=RagResponse,
    summary="Grounded-answer search over the German bureaucracy knowledge corpus",
    description=(
        "Frontend-facing root-level route. Body: `{query, top_k?, institution?}`. "
        "Returns `{hits: [{text, score, metadata}]}`. The `text` is German "
        "(it's a legal/institutional reference) — never translated by the API. "
        "Empty `hits: []` is valid (the chat falls back to a generic answer)."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated."},
    },
)
def rag_search_public(
    payload: RagQuery,
    _: User = Depends(get_current_user),
):
    where = {"institution": payload.institution} if payload.institution else None
    hits = store.search(payload.query, top_k=payload.top_k, where=where)
    return RagResponse(hits=[RagHit(**h) for h in hits])

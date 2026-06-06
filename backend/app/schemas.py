"""Pydantic request/response schemas (not tied to DB tables).

This module is the source of truth for what crosses the wire. Everything that
appears in the OpenAPI spec (and thus in the Posting collection / frontend
TypeScript types) comes from here.

Grouped sections:
- Extraction internals (ExtractedLetter / ExtractedAction)
- Public response shapes (LetterResponse, LetterListItem, DeadlineItem, ...)
- Auth response shapes
- SSE event payloads (for documentation of the /process stream)
- RAG search shapes
- Error envelope (shape of every non-2xx response — single source of truth)
"""

from datetime import date, datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models import (
    ActionStatus,
    DeadlineSource,
    DocumentCategory,
    LetterStatus,
    Severity,
)


class ExtractedAction(BaseModel):
    title: str
    description: str = ""
    deadline_iso: Optional[date] = None
    deadline_confidence: float = 0.0
    deadline_source: DeadlineSource = DeadlineSource.UNKNOWN
    severity: Severity = Severity.MEDIUM
    steps: list[str] = Field(default_factory=list)
    reply_needed: bool = False
    evidence_span: str = ""


class ExtractedLetter(BaseModel):
    document_type: str = ""
    institution: str = ""
    category: DocumentCategory = DocumentCategory.OTHER
    category_confidence: float = 0.0
    language_confidence: float = 0.0
    summary: str = ""
    ocr_text: str = ""
    actions: list[ExtractedAction] = Field(default_factory=list)
    extraction_warnings: list[str] = Field(default_factory=list)


class LetterListItem(BaseModel):
    """Compact shape used by GET /api/letters list endpoint."""

    id: UUID
    letter_type: str
    category: DocumentCategory
    risk_score: int
    deadline_date: Optional[date] = None
    status: LetterStatus
    created_at: datetime


class LetterResponse(BaseModel):
    id: UUID
    institution: str
    document_type: str
    letter_type: str
    category: DocumentCategory
    summary: str
    language: str
    risk_score: int
    deadline_date: Optional[date] = None
    explanation: str = ""
    response_draft: str = ""
    checklist: list[str] = Field(default_factory=list)
    citations: list[dict] = Field(default_factory=list)
    consequence: str = ""
    status: LetterStatus
    processed_at: Optional[datetime] = None
    created_at: datetime
    actions: list[dict] = Field(default_factory=list)
    extraction_warnings: list[str] = Field(default_factory=list)


class LetterUploadResponse(BaseModel):
    letter_id: UUID


class ActionUpdate(BaseModel):
    status: Optional[ActionStatus] = None
    deadline: Optional[date] = None
    title: Optional[str] = None
    description: Optional[str] = None


class DeadlineItem(BaseModel):
    """Spec-shaped /api/deadlines item — actually a view over ActionItem."""

    id: UUID
    letter_id: UUID
    title: str
    due_date: date
    status: ActionStatus
    risk_score: int
    severity: Severity
    category: DocumentCategory


class RagQuery(BaseModel):
    query: str
    top_k: int = 4
    institution: Optional[str] = None


class RagHit(BaseModel):
    text: str
    score: float
    metadata: dict


class RagResponse(BaseModel):
    hits: list[RagHit]


# ===================================================================
# Auth response shapes
# ===================================================================


class UserPublic(BaseModel):
    """Public profile of the authenticated user. Never exposes password_hash."""

    id: str
    email: EmailStr
    language: str = Field(description="ISO 639-1 short code: 'en' or 'de'.")
    timezone: str = Field(description="IANA timezone, e.g. 'Europe/Berlin'.")
    created_at: datetime


class AuthResponse(BaseModel):
    """Successful signup or login. Cookie is set by the server."""

    user: UserPublic


class OkResponse(BaseModel):
    """Generic ok envelope for endpoints with no body to return."""

    ok: bool = True


class ForgotPasswordResponse(BaseModel):
    """Identical shape for known and unknown emails — no enumeration.

    In dev mode (`DEV_AUTH_EXPOSE_RESET_TOKEN=true`) the reset token is
    included so the frontend can drive end-to-end testing without SMTP.
    """

    ok: bool = True
    message: str
    dev_reset_token: Optional[str] = Field(
        default=None,
        description="Dev-only: present only when DEV_AUTH_EXPOSE_RESET_TOKEN=true.",
    )
    dev_expires_at: Optional[datetime] = None


# ===================================================================
# Error envelope (shape of every non-2xx response)
# ===================================================================


class ValidationFieldError(BaseModel):
    field: str = Field(description="Dotted path to the offending field.")
    message: str


class ErrorDetails(BaseModel):
    """Optional structured extras attached to an error envelope."""

    errors: Optional[list[ValidationFieldError]] = None
    declared: Optional[str] = None
    detected: Optional[str] = None


class ErrorResponse(BaseModel):
    """Every non-2xx response from this API has this shape.

    Frontend code should switch on `code` (stable identifier), display
    `message` to the user, and inspect `details` for field-level
    information on `VALIDATION_ERROR`s.
    """

    code: str = Field(
        description="Stable machine-readable identifier — see docs/06-api-contract.md."
    )
    message: str = Field(description="Localized, user-facing copy.")
    details: Optional[ErrorDetails] = None


# ===================================================================
# SSE event payloads (documentation for /api/letters/{id}/process)
# ===================================================================
# The SSE stream is text/event-stream — these schemas describe the JSON
# payload inside each `data:` frame. Frontend can use them to type the
# EventSource handlers.


class SSEOcrResult(BaseModel):
    text: str = Field(description="Verbatim German OCR'd text.")


class SSEClassification(BaseModel):
    type: str = Field(description="Specific German document name, e.g. 'Mahnung'.")
    category: DocumentCategory
    agency: str = Field(description="Sender institution as printed on the letter.")
    category_confidence: float = Field(ge=0.0, le=1.0)


class SSERiskScore(BaseModel):
    score: int = Field(ge=0, le=100)
    label: Literal["Critical", "High", "Medium", "Low"]


class SSEDeadline(BaseModel):
    date: Optional[date] = None
    days_remaining: Optional[int] = None
    note: Optional[str] = None


class SSEConsequence(BaseModel):
    text: str


class SSEStreamChunk(BaseModel):
    """Used by `explanation` and `response_draft` events — one token chunk."""

    chunk: str


class SSEChecklist(BaseModel):
    items: list[str]


class SSECitationItem(BaseModel):
    section: str
    text: str
    score: float


class SSECitations(BaseModel):
    items: list[SSECitationItem]


class SSEDone(BaseModel):
    letter_id: UUID


class SSEErrorPayload(BaseModel):
    """Error payload inside an SSE `data:` frame — same shape as ErrorResponse."""

    code: str
    message: str
    details: Optional[ErrorDetails] = None

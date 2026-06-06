"""Pydantic request/response schemas (not tied to DB tables)."""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

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

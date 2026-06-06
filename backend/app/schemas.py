"""Pydantic request/response schemas (not tied to DB tables)."""

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models import ActionStatus, DeadlineSource, DocumentCategory, Severity


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
    summary_en: str = ""
    actions: list[ExtractedAction] = Field(default_factory=list)
    extraction_warnings: list[str] = Field(default_factory=list)


class LetterResponse(BaseModel):
    id: UUID
    institution: str
    document_type: str
    category: DocumentCategory
    summary_en: str
    actions: list[dict]
    extraction_warnings: list[str]


class ActionUpdate(BaseModel):
    status: Optional[ActionStatus] = None
    deadline: Optional[date] = None
    title: Optional[str] = None
    description: Optional[str] = None


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

"""SSE pipeline orchestrator for /api/letters/{id}/process.

Architecture
============
The original spec (docs/02-backend.md) imagined three separate stages:

    OCR  →  ReAct Agent  →  RAG Generation

Each stage was a different dev's library. Since Nuriel owns the whole backend
(see memory: backend_ownership), we collapse those into two Qwen3.7-Plus calls
while still emitting the same SSE event sequence the frontend expects:

    Call 1 (non-streaming, vision + tool):
        ocr_result, classification, risk_score, deadline, consequence

    Call 2 (streaming, text):
        explanation chunks  →  response_draft chunks

    Single events from local computation:
        checklist, citations, done | error

The visible UX matches the spec's event timeline so the frontend doesn't need
to know we cheated. The events ARE the real extraction results — we just
deliver them in chunks for pacing.

DB session lifetime
===================
The generator OWNS its own `Session`. It does NOT accept one from the FastAPI
dependency, because dependency-injected sessions close when the route handler
returns (which happens immediately for StreamingResponse). The generator runs
AFTER that, so it must hold its own session for the entire stream.

Citations
=========
The spec example shows `§ 81 Abs. 4 AufenthG`-style legal citations. To stay
honest we surface ChromaDB seed-corpus hits as `citations` (real grounding
evidence) instead of inventing law-section numbers.
"""

import asyncio
import json
from datetime import date
from typing import AsyncIterator
from uuid import UUID

from sqlmodel import Session as DBSession

from app.database import engine
from app.models import (
    Letter,
    LetterStatus,
    Severity,
    utcnow,
)
from app.rag import store
from app.schemas import ExtractedLetter
from app.services.extraction import (
    extract_from_letter_file,
    generate_checklist,
    normalize_lang,
    stream_explanation,
    stream_response_draft,
)
from app.services.persistence import persist_extraction


SEVERITY_RANK = {
    Severity.CRITICAL: 4,
    Severity.HIGH: 3,
    Severity.MEDIUM: 2,
    Severity.LOW: 1,
}


def sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"


def _risk_label(score: int) -> str:
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def _most_urgent_action(extracted: ExtractedLetter):
    dated = [a for a in extracted.actions if a.deadline_iso is not None]
    if dated:
        return min(dated, key=lambda a: a.deadline_iso)
    if extracted.actions:
        return max(extracted.actions, key=lambda a: SEVERITY_RANK.get(a.severity, 0))
    return None


def _build_citations(extracted: ExtractedLetter) -> list[dict]:
    """Surface RAG seed-corpus hits as citations (honest grounding evidence)."""
    query = (
        f"{extracted.institution} {extracted.document_type} {extracted.category.value}"
    ).strip()
    if not query:
        return []
    hits = store.search(query, top_k=3)
    return [
        {
            "section": h["metadata"].get("institution")
            or h["metadata"].get("category", "knowledge"),
            "text": h["text"],
            "score": round(h["score"], 3),
        }
        for h in hits
    ]


def _mark_error(letter_id: UUID, message: str) -> None:
    """Best-effort: mark a letter as errored in its own short-lived session."""
    try:
        with DBSession(engine) as db:
            letter = db.get(Letter, letter_id)
            if letter is not None:
                letter.status = LetterStatus.ERROR
                db.add(letter)
                db.commit()
    except Exception:
        # Last-resort: swallow — we're already in the error path.
        pass


# ---------- public: SSE event stream ----------


async def process_letter_stream(letter_id: UUID, lang: str) -> AsyncIterator[str]:
    """Yield SSE-formatted text frames for /api/letters/{id}/process.

    The generator owns its own DB Session — opening it here (NOT via the route
    handler's Depends) so the session remains valid for the full stream.
    """
    out_lang = normalize_lang(lang)

    with DBSession(engine) as db:
        letter = db.get(Letter, letter_id)
        if letter is None:
            yield sse_event("error", {"message": "Letter not found"})
            return

        if not letter.original_file:
            yield sse_event("error", {"message": "Letter has no file on disk"})
            return

        letter.language = out_lang
        letter.status = LetterStatus.PROCESSING
        db.add(letter)
        db.commit()

        mime = (
            "application/pdf"
            if letter.original_file.lower().endswith(".pdf")
            else "image/jpeg"
        )

        try:
            # ---- Phase A: structured extraction (1 Qwen call) ----
            extracted = await extract_from_letter_file(
                letter.original_file, mime, lang=out_lang
            )

            persist_extraction(db, letter, extracted)
            db.commit()

            yield sse_event("ocr_result", {"text": extracted.ocr_text})
            await asyncio.sleep(0.08)

            yield sse_event(
                "classification",
                {
                    "type": extracted.document_type,
                    "category": extracted.category.value,
                    "agency": extracted.institution,
                    "category_confidence": extracted.category_confidence,
                },
            )
            await asyncio.sleep(0.08)

            yield sse_event(
                "risk_score",
                {
                    "score": letter.risk_score,
                    "label": _risk_label(letter.risk_score),
                },
            )
            await asyncio.sleep(0.08)

            urgent = _most_urgent_action(extracted)
            if urgent and urgent.deadline_iso:
                days_remaining = (urgent.deadline_iso - date.today()).days
                yield sse_event(
                    "deadline",
                    {
                        "date": urgent.deadline_iso.isoformat(),
                        "days_remaining": days_remaining,
                    },
                )
            else:
                yield sse_event(
                    "deadline",
                    {
                        "date": None,
                        "days_remaining": None,
                        "note": "No explicit deadline",
                    },
                )
            await asyncio.sleep(0.08)

            consequence_text = (
                urgent.description
                if urgent and urgent.description
                else extracted.summary
            )
            yield sse_event("consequence", {"text": consequence_text})
            letter.consequence = consequence_text
            db.add(letter)

            # ---- Phase B: streaming explanation ----
            explanation_buf: list[str] = []
            async for chunk in stream_explanation(extracted, out_lang):
                explanation_buf.append(chunk)
                yield sse_event("explanation", {"chunk": chunk})
            letter.explanation = "".join(explanation_buf)

            # ---- Phase B: streaming German response draft (conditional) ----
            if any(a.reply_needed for a in extracted.actions):
                response_buf: list[str] = []
                async for chunk in stream_response_draft(extracted):
                    response_buf.append(chunk)
                    yield sse_event("response_draft", {"chunk": chunk})
                letter.response_draft = "".join(response_buf)

            # ---- Single events: checklist + citations ----
            checklist = await generate_checklist(extracted, out_lang)
            letter.checklist = checklist
            yield sse_event("checklist", {"items": checklist})

            citations = _build_citations(extracted)
            letter.citations = citations
            yield sse_event("citations", {"items": citations})

            # ---- Done ----
            letter.status = LetterStatus.COMPLETED
            letter.processed_at = utcnow()
            db.add(letter)
            db.commit()

            yield sse_event("done", {"letter_id": str(letter.id)})

        except Exception as e:  # noqa: BLE001 — last-resort SSE error event
            try:
                letter.status = LetterStatus.ERROR
                db.add(letter)
                db.commit()
            except Exception:
                # If even THIS session is wedged, fall back to a brand new one.
                _mark_error(letter_id, str(e))
            yield sse_event("error", {"message": str(e)})

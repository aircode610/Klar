"""SSE pipeline orchestrator for /api/letters/{id}/process.

Architecture (post docs/07-integration)
=======================================
The original spec imagined three separate stages: OCR → ReAct Agent → RAG
Generation. The AI team built each (`ai/react_agent/ocr.py`,
`ai/react_agent/agent.py`, `ai/rag/retrieval.py`, `ai/rag/generator.py`).
This SSE orchestrator is the chassis that runs their full 4-step pipeline
end-to-end and emits Klar-shaped SSE events as each stage completes:

    1. ai.react_agent.ocr.extract_text_from_image(path)
       └─ emit: ocr_result   (~3s)

    2. ai.react_agent.agent.run_react_agent(ocr_text)  [LangGraph + Tavily]
       └─ emit: classification, risk_score, deadline, consequence   (~5-15s)

    3. ai.rag.retrieval.retrieve_legal_context(letter_type, consequence)
       └─ (internal; feeds the next call)

    4. ai_bridge.generate_grounded_response(...)
       └─ emit: explanation (chunked), response_draft (chunked),
                checklist, citations   (~5-10s)

    5. emit: done

Schema translation: all `ai.*` types are mapped to our `PublicAction` /
`Letter` / `RagHit` shapes by `app/services/ai_bridge.py`. Nothing in this
file imports from `ai.schemas` directly.

DB session lifetime
===================
The generator OWNS its own `Session` because FastAPI closes the injected
one as soon as `process_letter()` returns the StreamingResponse object —
before this generator body runs.
"""

import asyncio
import json
import logging
import os
from datetime import date
from typing import AsyncIterator
from uuid import UUID

from sqlmodel import Session as DBSession

from app.database import engine
from app.errors import ErrorCode, sse_error_payload
from app.models import (
    ActionItem,
    Letter,
    LetterStatus,
    RiskScore,
    utcnow,
)
from app.services import ai_bridge
from app.services.extraction import normalize_lang
from app.services.risk import compute_risk

logger = logging.getLogger("klar.pipeline")


# ---------- helpers ----------


def sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"


def _risk_label(score: int) -> str:
    """0-100 → display label (matches PublicLetter SSE event shape)."""
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


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
        pass


def _chunk_text_for_streaming(text: str, chunk_size: int = 40) -> list[str]:
    """Split a long text into ~chunk_size-char pieces, breaking on word
    boundaries when possible. Used to simulate streaming output of fields
    that we receive as one blob from the JSON-mode generator."""
    if not text:
        return []
    words = text.split(" ")
    chunks: list[str] = []
    buf = ""
    for w in words:
        if len(buf) + len(w) + 1 > chunk_size and buf:
            chunks.append(buf + " ")
            buf = w
        else:
            buf = f"{buf} {w}" if buf else w
    if buf:
        chunks.append(buf)
    return chunks


# ---------- public: SSE event stream ----------


async def process_letter_stream(letter_id: UUID, lang: str) -> AsyncIterator[str]:
    """Run the AI team's 4-step pipeline, streaming Klar-shaped SSE events.

    Replaces the previous single-vision-call engine with the
    OCR → ReAct → RAG-retrieval → Grounded-generator chain per
    docs/07 §15.
    """
    # Lazy imports so the langchain stack only loads when SSE is actually used.
    # WRAPPED in try/except so any failure (e.g. missing TAVILY_API_KEY in
    # the shell env when the AI agent module instantiates its Tavily tool)
    # yields a real SSE `error` event instead of letting the generator raise
    # BEFORE its first yield — that race causes the browser to see
    # ERR_INCOMPLETE_CHUNKED_ENCODING and infinitely reconnect.
    try:
        from ai.react_agent.ocr import extract_text_from_image
        from ai.react_agent.agent import run_react_agent
    except Exception as exc:
        logger.exception(
            "AI team's modules failed to import — check env (DASHSCOPE_API_KEY, "
            "TAVILY_API_KEY): %s", exc,
        )
        yield sse_event("error", sse_error_payload(
            ErrorCode.LLM_PROVIDER_ERROR,
            message=(
                "AI pipeline failed to initialize. Most likely cause: missing "
                "DASHSCOPE_API_KEY or TAVILY_API_KEY env var on the backend "
                "process. See server logs."
            ),
        ))
        return

    out_lang = normalize_lang(lang)

    with DBSession(engine) as db:
        letter = db.get(Letter, letter_id)
        if letter is None:
            yield sse_event("error", sse_error_payload(ErrorCode.LETTER_NOT_FOUND))
            return

        if not letter.original_file:
            yield sse_event("error", sse_error_payload(ErrorCode.LETTER_FILE_MISSING))
            return

        letter.language = out_lang
        letter.status = LetterStatus.PROCESSING
        db.add(letter)
        db.commit()

        try:
            # ============================================================
            # STAGE 1 — OCR (qwen-vl-ocr, ~3s)
            # ============================================================
            ocr_text = await extract_text_from_image(letter.original_file)
            letter.ocr_text = ocr_text
            db.add(letter)
            db.commit()

            yield sse_event("ocr_result", {"text": ocr_text})
            await asyncio.sleep(0.08)

            # ============================================================
            # STAGE 2 — ReAct agent (LangGraph + Tavily, ~5-15s)
            # ============================================================
            agent_events_collected = []
            classification_data: dict | None = None
            risk_label = "Medium"

            async for ev in run_react_agent(ocr_text):
                agent_events_collected.append(ev)

                if ev.type == "classification":
                    classification_data = ev.data
                    category = ai_bridge.map_classification_to_category(ev.data.get("type", ""))
                    letter.document_type = ev.data.get("type", "") or letter.document_type
                    letter.letter_type = letter.document_type
                    letter.category = category
                    letter.institution = ev.data.get("agency", "") or letter.institution
                    db.add(letter)
                    yield sse_event(
                        "classification",
                        {
                            "type": ev.data.get("type", ""),
                            "category": category.value,
                            "agency": ev.data.get("agency", ""),
                            "category_confidence": 0.85,
                        },
                    )

                elif ev.type == "risk_score":
                    # Their 1-5 score is informational. We compute the real
                    # 0-100 once an ActionItem exists (after we wrap the
                    # AgentAnalysis below). For now hold their label for
                    # later severity mapping.
                    risk_label = ev.data.get("label", "Medium")
                    # We don't emit risk_score yet — emit after our formula runs.

                elif ev.type == "deadline":
                    yield sse_event(
                        "deadline",
                        {
                            "date": ev.data.get("date"),
                            "days_remaining": ev.data.get("days_remaining"),
                        },
                    )

                elif ev.type == "consequence":
                    consequence_text = ev.data.get("text", "")
                    letter.consequence = consequence_text
                    db.add(letter)
                    yield sse_event("consequence", {"text": consequence_text})

                elif ev.type == "error":
                    logger.warning("ReAct agent emitted error: %s", ev.data.get("message"))
                    # Don't propagate immediately — try to continue with what we have.

                await asyncio.sleep(0.05)

            # Reconstruct AgentAnalysis-like dict from collected events
            from ai.schemas import AgentAnalysis, Classification, Deadline, Consequence, RiskScore as TheirRiskScore
            cls_data = next((e.data for e in agent_events_collected if e.type == "classification"), {})
            dl_data = next((e.data for e in agent_events_collected if e.type == "deadline"), {})
            rs_data = next((e.data for e in agent_events_collected if e.type == "risk_score"), {"score": 3, "label": "Medium", "reason": ""})
            cq_data = next((e.data for e in agent_events_collected if e.type == "consequence"), {"text": "", "severity": ""})

            analysis = AgentAnalysis(
                classification=Classification(type=cls_data.get("type", "Unknown"), agency=cls_data.get("agency", "Unknown")),
                deadline=Deadline(date=dl_data.get("date"), days_remaining=dl_data.get("days_remaining"), source="letter" if dl_data.get("date") else "none"),
                consequence=Consequence(text=cq_data.get("text", ""), severity=cq_data.get("severity", "")),
                risk_score=TheirRiskScore(score=rs_data.get("score", 3), label=rs_data.get("label", "Medium"), reason=rs_data.get("reason", "")),
            )
            unpacked = ai_bridge.unpack_agent_analysis(analysis)

            # Wrap as ONE ActionItem (multi-action limitation noted in docs/07 §5)
            action = ActionItem(
                letter_id=letter.id,
                title=letter.document_type or "Action required",
                description=unpacked["consequence"],
                steps=[],
                deadline=unpacked["deadline"],
                deadline_confidence=0.85 if unpacked["deadline"] else 0.0,
                deadline_source=unpacked["deadline_source"],
                severity=unpacked["severity"],
                reply_needed=True,  # Always offer a reply for SSE-extracted letters
                evidence_span="",
            )
            db.add(action)
            db.flush()

            # Compute OUR risk_score via deterministic formula
            risk = compute_risk(action, institution=letter.institution or "")
            db.add(RiskScore(action_item_id=action.id, **risk))
            letter.risk_score = risk["score"]
            letter.deadline_date = action.deadline
            db.add(letter)
            db.commit()

            # Now emit risk_score (we held it back until our formula ran)
            yield sse_event(
                "risk_score",
                {"score": risk["score"], "label": _risk_label(risk["score"])},
            )
            await asyncio.sleep(0.08)

            # If agent never emitted deadline (none found), emit a null deadline event
            if not dl_data.get("date"):
                yield sse_event(
                    "deadline",
                    {"date": None, "days_remaining": None, "note": "No explicit deadline"},
                )

            # ============================================================
            # STAGE 3 — Retrieve legal context (silent, ~1s)
            # ============================================================
            try:
                from ai.rag.retrieval import retrieve_legal_context
                # AI team's new signature (commit 61fd2b5): (letter_type, consequence, top_k)
                legal_chunks = retrieve_legal_context(
                    letter_type=letter.document_type or "",
                    consequence=letter.consequence or "",
                    top_k=5,
                )
            except Exception as e:
                logger.warning("Legal retrieval failed: %s — continuing without citations", e)
                legal_chunks = []

            # ============================================================
            # STAGE 4 — Grounded generation (~5-10s)
            # ============================================================
            agent_result = ai_bridge.synthesize_agent_result(letter, action=action)
            agent_result.risk_label = risk_label  # use their qualitative label for grounding context

            generation = await ai_bridge.generate_grounded_response(
                ocr_text=ocr_text,
                agent_result=agent_result,
                language=out_lang,
                legal_chunks=legal_chunks,
            )
            explanation, response_draft, checklist, citations = ai_bridge.unpack_generation_output(generation)

            # Stream explanation chunks
            for piece in _chunk_text_for_streaming(explanation, chunk_size=50):
                yield sse_event("explanation", {"chunk": piece})
                await asyncio.sleep(0.04)

            # Stream response_draft chunks (always German)
            for piece in _chunk_text_for_streaming(response_draft, chunk_size=50):
                yield sse_event("response_draft", {"chunk": piece})
                await asyncio.sleep(0.04)

            # Single events: checklist + citations
            yield sse_event("checklist", {"items": checklist})
            await asyncio.sleep(0.05)
            yield sse_event("citations", {"items": citations})

            # Persist long-form fields
            letter.explanation = explanation
            letter.response_draft = response_draft
            letter.checklist = checklist
            letter.citations = citations

            # ============================================================
            # Done
            # ============================================================
            letter.status = LetterStatus.COMPLETED
            letter.processed_at = utcnow()
            db.add(letter)
            db.commit()

            yield sse_event("done", {"letter_id": str(letter.id)})

        except Exception as exc:  # noqa: BLE001 — last-resort SSE error event
            logger.exception("Pipeline failed for letter %s: %s", letter_id, exc)
            try:
                letter.status = LetterStatus.ERROR
                db.add(letter)
                db.commit()
            except Exception:
                _mark_error(letter_id, str(exc))
            code = ErrorCode.EXTRACTION_FAILED
            module = type(exc).__module__
            if "openai" in module or "httpx" in module or "langchain" in module:
                code = ErrorCode.LLM_PROVIDER_ERROR
            elif "pdf2image" in module:
                code = ErrorCode.PDF_RENDER_FAILED
            yield sse_event("error", sse_error_payload(code))

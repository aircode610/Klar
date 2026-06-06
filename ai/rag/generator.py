"""
Klar — RAG Generator
ai/rag/generator.py

Consumes an AgentResult from the ReAct agent, retrieves relevant § paragraphs
from ChromaDB, and streams a Qwen LLM response as RAGEvents.

Usage (called by backend orchestrator):
    from ai.rag.generator import run_rag_pipeline

    async for event in run_rag_pipeline(agent_result, language="English"):
        # event.type: "explanation" | "response_draft" | "checklist" | "citations" | "error"
        # event.confidence: "high" | "low"
        send_to_frontend(event)
"""

import json
import os
import sys
from typing import AsyncGenerator

from openai import AsyncOpenAI

from ai.react_agent.schemas import AgentResult
from ai.rag.retrieval import retrieve_legal_context, retrieve_as_context
from ai.rag.schemas import RAGEvent

# ── Qwen LLM client ───────────────────────────────────────────────────────────

_async_client = None

def _get_async_client() -> AsyncOpenAI:
    global _async_client
    if _async_client is None:
        api_key = os.getenv("DASHSCOPE_API_KEY")
        if not api_key:
            print("ERROR: DASHSCOPE_API_KEY not set.")
            sys.exit(1)
        _async_client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        )
    return _async_client


# ── Confidence threshold ──────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.4

# ── Prompt template ───────────────────────────────────────────────────────────

GENERATION_PROMPT = """\
You are Klar, an expert assistant helping international students in Germany \
understand and respond to official letters.

## The Letter
{ocr_text}

## Classification
Type: {letter_type}
Agency: {agency}
Deadline: {deadline_date} ({days_remaining} days remaining)
Risk: {risk_score}/5 — {risk_label}
Consequence: {consequence}

## Relevant Legal References
{legal_context}

{no_rag_note}

## Your Tasks

Generate the following four sections IN ORDER using EXACTLY these headers.
Do not skip any section. Do not add extra text between sections.

---EXPLANATION---
Write a clear, plain-language explanation of this letter in {language}.
- What is this letter about?
- Who sent it and why?
- What action is required?
- What is the deadline?
- What happens if the deadline is missed?
Reference the relevant § paragraphs where appropriate.

---RESPONSE_DRAFT---
Write a formal response letter in Behördendeutsch (official German) that the
user can send back to the agency. Include:
- Proper formal salutation and closing
- Reference number (Aktenzeichen) if visible in the letter
- Clear statement of what is being submitted/responded to
- Professional, bureaucratic tone

---CHECKLIST---
Output ONLY a JSON array of strings listing all documents the user needs.
Example: ["Reisepass", "Krankenversicherungsnachweis", "Immatrikulationsbescheinigung"]

---CITATIONS---
Output ONLY a JSON array of objects with "section" and "text" fields.
Example: [{{"section": "§ 81 Abs. 4 AufenthG", "text": "Requires timely submission..."}}]
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

MARKERS = [
    "---EXPLANATION---",
    "---RESPONSE_DRAFT---",
    "---CHECKLIST---",
    "---CITATIONS---",
]

def _parse_json_section(text: str) -> list:
    """Safely parse a JSON array from LLM output, stripping markdown fences."""
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        # grab the content inside the first code fence
        text = parts[1] if len(parts) > 1 else parts[0]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    try:
        result = json.loads(text)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        return []


def _determine_confidence(chunks) -> str:
    if not chunks:
        return "low"
    return "high" if max(c.score for c in chunks) >= CONFIDENCE_THRESHOLD else "low"


def _split_sections(full_text: str) -> dict:
    """Split full LLM output into named sections by marker headers."""
    sections = {}
    current = None
    current_lines = []

    for line in full_text.splitlines():
        stripped = line.strip()
        if stripped in MARKERS:
            if current is not None:
                sections[current] = "\n".join(current_lines).strip()
            current = stripped.strip("-")
            current_lines = []
        else:
            current_lines.append(line)

    if current is not None:
        sections[current] = "\n".join(current_lines).strip()

    return sections


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_rag_pipeline(
    agent_result: AgentResult,
    language: str = "English",
) -> AsyncGenerator[RAGEvent, None]:
    """
    Full RAG pipeline: retrieve legal context → prompt Qwen → stream RAGEvents.

    Yields:
        RAGEvent(type="explanation",    data={"chunk": str})   — streamed
        RAGEvent(type="response_draft", data={"chunk": str})   — streamed
        RAGEvent(type="checklist",      data={"items": [...]}) — once
        RAGEvent(type="citations",      data={"items": [...]}) — once
        RAGEvent(type="error",          data={"message": str}) — on failure
    """
    try:
        # Step 1: Retrieve legal context
        chunks = retrieve_legal_context(
            ocr_text=agent_result.ocr_text,
            letter_type=agent_result.letter_type,
            top_k=5,
        )
        confidence = _determine_confidence(chunks)
        legal_context = retrieve_as_context(
            ocr_text=agent_result.ocr_text,
            letter_type=agent_result.letter_type,
            top_k=5,
        )

        no_rag_note = ""
        if confidence == "low":
            no_rag_note = (
                "NOTE: No strong legal paragraph matches were found in the "
                "knowledge base for this letter type. Rely on your own knowledge "
                "and clearly mark that no § citations were verified against source text."
            )

        # Step 2: Build prompt
        prompt = GENERATION_PROMPT.format(
            ocr_text=agent_result.ocr_text,
            letter_type=agent_result.letter_type,
            agency=agent_result.agency,
            deadline_date=agent_result.deadline_date or "Not specified",
            days_remaining=(
                agent_result.days_remaining
                if agent_result.days_remaining is not None
                else "Unknown"
            ),
            risk_score=agent_result.risk_score,
            risk_label=agent_result.risk_label,
            consequence=agent_result.consequence,
            legal_context=legal_context,
            no_rag_note=no_rag_note,
            language=language,
        )

        # Step 3: Collect full response (streaming to frontend token-by-token
        # while also buffering for section parsing)
        client = _get_async_client()
        stream = await client.chat.completions.create(
            model=os.getenv("QWEN_RAG_MODEL", "qwen-plus"),
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            max_tokens=4096,
            temperature=0.3,
        )

        full_response = ""
        current_section = None
        section_buffer = ""

        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            full_response += delta
            section_buffer += delta

            # Check if a new section marker appeared in the buffer
            for marker in MARKERS:
                if marker in section_buffer:
                    before, after = section_buffer.split(marker, 1)
                    # Emit any clean text from the previous streaming section
                    if current_section in ("EXPLANATION", "RESPONSE_DRAFT") and before.strip():
                        yield RAGEvent(
                            type=current_section.lower(),
                            data={"chunk": before},
                            confidence=confidence,
                        )
                    current_section = marker.strip("-")
                    section_buffer = after
                    break
            else:
                # No marker — stream text sections live
                if current_section in ("EXPLANATION", "RESPONSE_DRAFT"):
                    # Only emit if we have a clean token (no partial marker)
                    safe = section_buffer
                    for m in MARKERS:
                        # Hold back if a partial marker might be forming
                        for i in range(1, len(m)):
                            if safe.endswith(m[:i]):
                                safe = safe[: -i]
                                break
                    if safe:
                        yield RAGEvent(
                            type=current_section.lower(),
                            data={"chunk": safe},
                            confidence=confidence,
                        )
                        section_buffer = section_buffer[len(safe):]

        # Step 4: Parse structured sections from full response
        sections = _split_sections(full_response)

        checklist = _parse_json_section(sections.get("CHECKLIST", "[]"))
        yield RAGEvent(type="checklist", data={"items": checklist}, confidence=confidence)

        citations = _parse_json_section(sections.get("CITATIONS", "[]"))
        yield RAGEvent(type="citations", data={"items": citations}, confidence=confidence)

    except Exception as e:
        yield RAGEvent(type="error", data={"message": str(e)}, confidence="low")
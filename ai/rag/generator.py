import json
import os
from dataclasses import dataclass

from openai import AsyncOpenAI

from ai.react_agent.schemas import AgentResult
from ai.prompts import GENERATION_PROMPT

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
QWEN_API_BASE = os.environ.get(
    "QWEN_API_BASE", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)
QWEN_AGENT_MODEL = os.environ.get("QWEN_AGENT_MODEL", "qwen3.7-plus")

LANGUAGE_NAMES = {
    "en": "English",
    "de": "German",
    "tr": "Turkish",
    "ar": "Arabic",
    "es": "Spanish",
    "fr": "French",
    "zh": "Chinese",
    "fa": "Persian",
}


@dataclass
class RAGResult:
    explanation: str
    response_draft: str
    checklist: list[str]
    citations: list[dict]
    confidence: str  # "high" if RAG matched, "low" if not


async def generate_response(
    ocr_text: str,
    agent_result: AgentResult,
    language: str = "en",
) -> RAGResult:
    """
    Call Qwen LLM with the letter context and agent analysis.
    Returns structured RAGResult with explanation, response draft, checklist, citations.
    No RAG retrieval for now — the LLM works from its own legal knowledge
    with strict anti-hallucination constraints.
    """
    lang_name = LANGUAGE_NAMES.get(language, "English")
    prompt = GENERATION_PROMPT.format(
        ocr_text=ocr_text[:3000],
        letter_type=agent_result.letter_type,
        agency=agent_result.agency,
        deadline_date=agent_result.deadline_date or "Not specified",
        days_remaining=agent_result.days_remaining or "Unknown",
        risk_score=agent_result.risk_score,
        risk_label=agent_result.risk_label,
        consequence=agent_result.consequence,
        legal_context="[NO LEGAL REFERENCES LOADED — do NOT cite any § numbers unless you are 100% certain they exist. Prefer explaining without citations over citing something that might be wrong.]",
        language=lang_name,
    )

    client = AsyncOpenAI(api_key=DASHSCOPE_API_KEY, base_url=QWEN_API_BASE)
    response = await client.chat.completions.create(
        model=QWEN_AGENT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=4096,
    )

    full_response = response.choices[0].message.content or ""

    explanation = _extract_section(full_response, "EXPLANATION", "RESPONSE_DRAFT")
    response_draft = _extract_section(full_response, "RESPONSE_DRAFT", "CHECKLIST")
    checklist = _parse_json_section(full_response, "CHECKLIST", "CITATIONS")
    citations = _parse_json_section(full_response, "CITATIONS", None)

    return RAGResult(
        explanation=explanation,
        response_draft=response_draft,
        checklist=checklist if isinstance(checklist, list) else [],
        citations=citations if isinstance(citations, list) else [],
        confidence="low",  # no RAG loaded yet
    )


def _extract_section(text: str, start_marker: str, end_marker: str | None) -> str:
    """Extract text between two ---MARKER--- delimiters."""
    start = f"---{start_marker}---"
    end = f"---{end_marker}---" if end_marker else None

    if start not in text:
        return ""

    after_start = text.split(start, 1)[1]
    if end and end in after_start:
        return after_start.split(end, 1)[0].strip()
    return after_start.strip()


def _parse_json_section(text: str, start_marker: str, end_marker: str | None) -> list:
    """Extract and parse a JSON array between two ---MARKER--- delimiters."""
    raw = _extract_section(text, start_marker, end_marker)
    if not raw:
        return []

    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0]
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0]

    start_idx = raw.find("[")
    end_idx = raw.rfind("]")
    if start_idx == -1 or end_idx == -1:
        return []

    try:
        return json.loads(raw[start_idx:end_idx + 1])
    except json.JSONDecodeError:
        return []

import os

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from ai.react_agent.schemas import AgentResult, GenerationOutput
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


async def generate_response(
    ocr_text: str,
    agent_result: AgentResult,
    language: str = "en",
) -> GenerationOutput:
    """
    Call Qwen LLM with letter context and agent analysis.
    Returns structured GenerationOutput via with_structured_output — no manual parsing.
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

    model = ChatOpenAI(
        model=QWEN_AGENT_MODEL,
        api_key=DASHSCOPE_API_KEY,
        base_url=QWEN_API_BASE,
        temperature=0,
        max_tokens=4096,
        extra_body={"enable_thinking": False},
    )

    structured_model = model.with_structured_output(GenerationOutput, method="json_mode")
    result = await structured_model.ainvoke([HumanMessage(content=prompt)])

    return result

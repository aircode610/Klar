"""Vision + structured extraction via Qwen3.7-Plus (OpenAI-compatible API)."""

import base64
import json

from openai import AsyncOpenAI

from app.config import settings
from app.models import DocumentCategory
from app.rag import store
from app.schemas import ExtractedLetter


DOCUMENT_CATEGORIES: list[str] = [c.value for c in DocumentCategory]

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
    return _client


EXTRACT_FUNCTION = {
    "type": "function",
    "function": {
        "name": "extract_obligations",
        "description": (
            "Extract structured obligations, deadlines, and required actions from a German "
            "bureaucratic letter."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_type": {
                    "type": "string",
                    "description": (
                        "The specific German document name as it appears on the letter "
                        "(e.g., 'Beitragsrechnung', 'Mahnung', 'Steuerbescheid', "
                        "'Mieterhöhung', 'Bußgeldbescheid')."
                    ),
                },
                "institution": {
                    "type": "string",
                    "description": (
                        "The exact name of the sender institution as printed on the letter "
                        "(e.g., 'AOK Bayern', 'Finanzamt Hamburg-Mitte', 'Beitragsservice "
                        "ARD ZDF Deutschlandradio')."
                    ),
                },
                "category": {
                    "type": "string",
                    "enum": DOCUMENT_CATEGORIES,
                    "description": (
                        "High-level classification. Pick the single best-fitting bucket. "
                        "Use 'other' only when no category fits."
                    ),
                },
                "category_confidence": {
                    "type": "number",
                    "description": "0.0–1.0 confidence in the category assignment.",
                },
                "language_confidence": {"type": "number"},
                "summary_en": {
                    "type": "string",
                    "description": "Plain English summary, max 2 sentences.",
                },
                "extraction_warnings": {"type": "array", "items": {"type": "string"}},
                "actions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "deadline_iso": {
                                "type": "string",
                                "description": "YYYY-MM-DD, or empty string if unknown.",
                            },
                            "deadline_confidence": {"type": "number"},
                            "deadline_source": {
                                "type": "string",
                                "enum": ["explicit", "inferred", "unknown"],
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["critical", "high", "medium", "low"],
                            },
                            "steps": {"type": "array", "items": {"type": "string"}},
                            "reply_needed": {"type": "boolean"},
                            "evidence_span": {
                                "type": "string",
                                "description": "Exact German quote from source doc.",
                            },
                        },
                        "required": ["title", "severity"],
                    },
                },
            },
            "required": [
                "document_type",
                "institution",
                "category",
                "summary_en",
                "actions",
            ],
        },
    },
}


CATEGORY_GUIDE = """\
Classify the letter into exactly one of these categories:

- health_insurance: Krankenkasse / Krankenversicherung — AOK, TK, BARMER, DAK, \
private KV. Letters: Beitragsrechnung, Mahnung, Mitgliedsbescheinigung.
- other_insurance: Haftpflicht, Hausrat, KFZ, Lebens-, Reise-, Berufsunfähigkeit. \
Senders: Allianz, HUK, ADAC, R+V. Letters: Beitragsanpassung, Schadenmeldung, \
Kündigungsbestätigung.
- banking: bank accounts, credit cards, loans, SCHUFA. Senders: Sparkasse, Deutsche \
Bank, N26, Commerzbank, ING, SCHUFA. Letters: Kontoauszug, Vertragsänderung, \
Kreditkartenabrechnung, SCHUFA-Auskunft.
- tax: Finanzamt only. Letters: Steuerbescheid, Mahnung wegen Steuern, Aufforderung \
zur Abgabe der Steuererklärung.
- immigration: Ausländerbehörde. Letters: Aufenthaltstitel, Verlängerung, \
Fiktionsbescheinigung, Terminbestätigung.
- education: Universität, Hochschule, Studentenwerk, BAföG-Amt. Letters: \
Immatrikulationsbescheinigung, Rückmeldungsaufforderung, Exmatrikulationsbescheid, \
BAföG-Bescheid, Bewilligungsbescheid.
- housing: Vermieter, Hausverwaltung. Letters: Mieterhöhung, Nebenkostenabrechnung, \
Mahnung Miete, Kündigung des Mietverhältnisses.
- utilities: Strom, Gas, Wasser, Internet, Telefon, Mobilfunk, Müllabfuhr. Senders: \
Stadtwerke, Vattenfall, E.ON, Telekom, Vodafone, O2, 1&1. Letters: Jahresabrechnung, \
Abschlagserhöhung, Vertragsänderung, Mahnung.
- employment: Arbeitgeber and HR letters. Letters: Lohn-/Gehaltsabrechnung, \
Arbeitsvertrag, Zwischen-/Arbeitszeugnis, Lohnsteuerbescheinigung, Kündigung \
durch Arbeitgeber.
- government_benefits: Bundesagentur für Arbeit, Jobcenter, Familienkasse, \
Wohngeldstelle. Programs: ALG I/II, Bürgergeld, Kindergeld, Elterngeld, Wohngeld. \
Letters: Bewilligungsbescheid, Aufforderung zur Mitwirkung, Sanktionsbescheid.
- pension: Deutsche Rentenversicherung. Letters: Versicherungsverlauf, \
Renteninformation, Rentenbescheid, Beitragsaufforderung (Selbstständige).
- broadcast_fee: Beitragsservice ARD ZDF Deutschlandradio (formerly GEZ). Letters: \
Festsetzungsbescheid, Mahnung Rundfunkbeitrag.
- civic: Bürgeramt, Einwohnermeldeamt, Standesamt, Personalausweisbehörde. Letters: \
Anmeldebestätigung, Meldebescheinigung, Terminbestätigung, Aufforderung Pass-/\
Ausweisabholung.
- legal_debt: Amtsgericht, Mahngericht, Inkasso-Dienste (EOS, Creditreform, Lowell, \
Riverty), Bußgeldstellen, Anwaltskanzleien. Letters: Mahnbescheid, \
Vollstreckungsbescheid, Inkassoforderung, Bußgeldbescheid, Anwaltsschreiben.
- other: only when none of the above fits.
"""


SYSTEM_PROMPT = (
    "You are a German bureaucratic document interpreter. Read the attached letter and "
    "extract every legal obligation, deadline, and required action. Return your output "
    "ONLY via the extract_obligations function.\n\n"
    "Classification:\n"
    "- You MUST pick exactly one category from the enumerated list.\n"
    "- Provide category_confidence between 0.0 and 1.0.\n"
    "- Use 'other' only as a last resort.\n\n" + CATEGORY_GUIDE + "\n"
    "Rules:\n"
    "- If a deadline is not explicitly stated, you may infer it with low confidence and "
    "set deadline_source='inferred'. If you cannot determine a value, return an empty "
    "string — NEVER invent dates, amounts, or reference numbers.\n"
    "- Every action MUST include an evidence_span: the exact German sentence the action "
    "came from.\n"
    "- Document_type should be the specific German document name (e.g., 'Mahnung', "
    "'Beitragsrechnung', 'Steuerbescheid'), not the category.\n"
    "- You do not provide legal advice."
)


async def extract_from_image(image_bytes: bytes, mime: str = "image/jpeg") -> ExtractedLetter:
    """Send image + RAG-augmented system prompt to Qwen; parse the tool call."""
    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{mime};base64,{b64}"

    rag_hits = store.search(
        "German bureaucratic institution identification deadline phrasing",
        top_k=4,
    )
    rag_context = "\n".join(f"- {h['text']}" for h in rag_hits)

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT + "\n\nReference knowledge:\n" + rag_context,
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract all obligations from this letter."},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        },
    ]

    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        tools=[EXTRACT_FUNCTION],
        tool_choice={"type": "function", "function": {"name": "extract_obligations"}},
        temperature=0.1,
    )

    tool_calls = response.choices[0].message.tool_calls or []
    if not tool_calls:
        raise RuntimeError("Model returned no tool call; check model + prompt compatibility.")
    payload = json.loads(tool_calls[0].function.arguments)

    for action in payload.get("actions", []):
        if action.get("deadline_iso") in ("", None):
            action["deadline_iso"] = None

    return ExtractedLetter.model_validate(payload)

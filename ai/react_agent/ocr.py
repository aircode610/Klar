import base64
import os

import httpx

from ai.prompts import OCR_PROMPT

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
QWEN_API_BASE = os.environ.get(
    "QWEN_API_BASE", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)

# Dedicated OCR model — faster and more accurate for text extraction
QWEN_OCR_MODEL = os.environ.get("QWEN_OCR_MODEL", "qwen-vl-ocr")


class OcrError(Exception):
    """Raised when OCR can't produce usable text from an image.

    Covers a malformed provider response (missing `choices`/`content`) and a
    blank result (an image-only scan with nothing readable). The backend maps
    this to a friendly `EXTRACTION_FAILED` instead of crashing with a raw
    KeyError/IndexError (which previously surfaced as a 500).
    """


def _parse_ocr_response(result: object) -> str:
    """Defensively pull the text content out of a chat-completions response.

    The happy path is `result["choices"][0]["message"]["content"]`, but blank
    scans and provider hiccups can return no choices, a null message, or null
    content. Any of those previously raised KeyError/IndexError/TypeError and
    bubbled up as a 500 — here they become a typed `OcrError`.
    """
    if not isinstance(result, dict):
        raise OcrError("The document reader returned an unexpected response.")

    choices = result.get("choices")
    if not isinstance(choices, list) or not choices:
        raise OcrError(
            "Could not read any text from this document. It may be a scanned "
            "image without readable content."
        )

    message = (
        (choices[0] or {}).get("message") if isinstance(choices[0], dict) else None
    )
    content = (message or {}).get("content") if isinstance(message, dict) else None

    if not content or not str(content).strip():
        raise OcrError(
            "Could not read any text from this document. It may be a scanned "
            "image without readable content."
        )

    return str(content)


async def extract_text_from_image(image_path: str) -> str:
    """Send image to Qwen-VL-OCR and return extracted text.

    Raises `OcrError` if the provider returns a malformed or empty response
    (e.g. a blank/unreadable scan) so the caller can surface a graceful error.
    """
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    # Detect MIME type
    ext = image_path.rsplit(".", 1)[-1].lower()
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
    mime_type = mime_map.get(ext, "image/jpeg")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{QWEN_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": QWEN_OCR_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}",
                                    "min_pixels": 3072,
                                    "max_pixels": 8388608,
                                },
                            },
                            {"type": "text", "text": OCR_PROMPT},
                        ],
                    }
                ],
            },
        )
        response.raise_for_status()
        return _parse_ocr_response(response.json())

import httpx
import base64
import os
from io import BytesIO

from ai.prompts import OCR_PROMPT

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
QWEN_API_BASE = os.environ.get(
    "QWEN_API_BASE", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)

# Dedicated OCR model — faster and more accurate for text extraction
QWEN_OCR_MODEL = os.environ.get("QWEN_OCR_MODEL", "qwen-vl-ocr")


async def _ocr_image_bytes(image_bytes: bytes, mime_type: str) -> str:
    """Send pre-loaded image bytes to Qwen-VL-OCR and return extracted text.

    Low-level helper used by ``extract_text_from_image``.  Callers are
    responsible for supplying the correct ``mime_type``
    (e.g. ``"image/png"`` or ``"image/jpeg"``).
    """
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

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
        result = response.json()
        return result["choices"][0]["message"]["content"]


async def extract_text_from_image(image_path: str) -> str:
    """Extract text from an image or PDF file using Qwen-VL-OCR.

    For **PDF files** the document is first rendered to one PNG image per page
    via ``pdf2image``/poppler (up to 12 pages); each page is OCR'd
    independently and the results are joined with a double newline so the full
    document text is returned as a single string.

    For **image files** (JPEG, PNG, WebP, HEIC) the bytes are sent directly to
    the Qwen vision model.

    Previously this function sent raw PDF bytes with a hard-coded
    ``image/jpeg`` MIME type, which caused the Qwen API to return a 4xx error
    for every scanned-PDF upload.  The fix renders PDFs to PNG first.

    Raises:
        ValueError: if the PDF has no renderable pages (empty or corrupted).
        RuntimeError: if the ``pdf2image`` package is not installed.
        httpx.HTTPStatusError: if the Qwen API returns a non-2xx response.
    """
    ext = image_path.rsplit(".", 1)[-1].lower()

    # ── PDF: render each page to PNG, then OCR page-by-page ────────────────────────
    if ext == "pdf":
        try:
            from pdf2image import convert_from_path
        except ImportError as exc:
            raise RuntimeError(
                "pdf2image is not installed. "
                "Install it with: pip install pdf2image  (also requires poppler)."
            ) from exc

        try:
            pages = convert_from_path(image_path, dpi=200, first_page=1, last_page=12)
        except Exception as exc:
            raise ValueError(
                f"Could not render PDF '{image_path}'. "
                "The file may be corrupted, password-protected, or not a valid PDF."
            ) from exc

        if not pages:
            raise ValueError(
                "The PDF appears to be empty — no pages could be rendered. "
                "Please check the file and try again."
            )

        page_texts: list[str] = []
        for img in pages:
            buf = BytesIO()
            img.save(buf, format="PNG")
            text = await _ocr_image_bytes(buf.getvalue(), "image/png")
            page_texts.append(text)

        return "\n\n".join(page_texts)

    # ── Image: read bytes and OCR directly ─────────────────────────────────────
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    mime_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "heic": "image/heic",
    }
    mime_type = mime_map.get(ext, "image/jpeg")

    return await _ocr_image_bytes(image_bytes, mime_type)

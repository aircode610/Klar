import httpx
import base64
import os

from ai.prompts import OCR_PROMPT

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
QWEN_API_BASE = os.environ.get(
    "QWEN_API_BASE", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)

# Dedicated OCR model — faster and more accurate for text extraction
QWEN_OCR_MODEL = os.environ.get("QWEN_OCR_MODEL", "qwen-vl-ocr")

# Cap on how many PDF pages we render/OCR so a huge document doesn't blow up
# the request count. Mirrors backend/app/services/pdf_pages.max_pages.
MAX_PDF_PAGES = 12


class OcrError(Exception):
    """Raised when a file can't be turned into OCR-able image input.

    Carries a user-facing message so the pipeline can surface a graceful error
    instead of leaking a raw 500 / decode failure.
    """


def _pdf_to_png_bytes(pdf_path: str) -> list[bytes]:
    """Render up to MAX_PDF_PAGES pages of a PDF to PNG bytes via poppler.

    Imported lazily so non-PDF callers don't pay the pdf2image import cost.
    """
    try:
        from pdf2image import convert_from_path
    except ImportError as exc:  # pragma: no cover - environment misconfig
        raise OcrError(
            "Could not read this PDF — the server is missing PDF support."
        ) from exc

    try:
        pages = convert_from_path(
            pdf_path, dpi=200, first_page=1, last_page=MAX_PDF_PAGES
        )
    except Exception as exc:
        # PDFPageCountError / PDFInfoNotInstalledError / corrupt file, etc.
        raise OcrError(
            "Could not read this PDF. It may be corrupted or password-protected."
        ) from exc

    from io import BytesIO

    out: list[bytes] = []
    for img in pages:
        buf = BytesIO()
        img.save(buf, format="PNG")
        out.append(buf.getvalue())

    if not out:
        raise OcrError(
            "Could not extract any pages from this PDF. "
            "It may be an empty or unsupported document."
        )
    return out


async def _ocr_image_bytes(
    client: httpx.AsyncClient, image_bytes: bytes, mime_type: str
) -> str:
    """Send a single image (as bytes) to Qwen-VL-OCR and return its text."""
    base64_image = base64.b64encode(image_bytes).decode("utf-8")
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
    """OCR a letter file (image or PDF) via Qwen-VL-OCR.

    PDFs are rendered to one PNG per page (poppler/pdf2image) before OCR — the
    OCR model can only decode real images, so handing it raw PDF bytes would
    fail. Each page is OCR'd and the text is concatenated. A scanned image-only
    PDF is rendered exactly like any other, so it OCRs fine.
    """
    ext = image_path.rsplit(".", 1)[-1].lower() if "." in image_path else ""

    async with httpx.AsyncClient(timeout=60.0) as client:
        if ext == "pdf":
            page_pngs = _pdf_to_png_bytes(image_path)
            page_texts: list[str] = []
            for png in page_pngs:
                page_texts.append(await _ocr_image_bytes(client, png, "image/png"))
            text = "\n\n".join(t for t in page_texts if t)
            if not text.strip():
                raise OcrError(
                    "Could not extract text from this PDF. "
                    "It may be a scanned image without readable content."
                )
            return text

        with open(image_path, "rb") as f:
            image_bytes = f.read()
        mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
        mime_type = mime_map.get(ext, "image/jpeg")
        return await _ocr_image_bytes(client, image_bytes, mime_type)

"""Convert a PDF file into a list of PNG image bytes, one per page.

Requires `poppler` to be installed on the host:
    macOS:   brew install poppler
    Linux:   apt-get install poppler-utils
"""

from io import BytesIO
from typing import Iterable


class PdfRenderError(Exception):
    """Raised when a PDF cannot be rendered to page images.

    Covers a missing/broken poppler install (`pdf2image` raises
    `PDFInfoNotInstalledError`), a corrupt or password-protected file
    (`PDFPageCountError` / `PDFSyntaxError`), and the edge case where poppler
    succeeds but produces zero pages. Callers catch this to surface a
    user-friendly `PDF_RENDER_FAILED` error instead of a raw 500.
    """


def pdf_to_image_bytes(path: str, *, dpi: int = 200, max_pages: int = 12) -> list[bytes]:
    """Render up to `max_pages` pages of `path` to PNG bytes.

    Imported lazily so callers that never touch a PDF don't pay the
    pdf2image / poppler import cost.

    Raises `PdfRenderError` if the PDF can't be rendered (corrupt file,
    poppler missing) or renders to zero pages — NEVER lets a raw pdf2image
    exception escape, so upstream callers can map it to a friendly error.
    """
    from pdf2image import convert_from_path

    try:
        pages = convert_from_path(path, dpi=dpi, first_page=1, last_page=max_pages)
    except Exception as exc:  # noqa: BLE001 — normalize every pdf2image failure
        raise PdfRenderError(
            "Could not render this PDF. It may be corrupt, password-protected, "
            "or the server is missing poppler."
        ) from exc

    out: list[bytes] = []
    for img in pages:
        buf = BytesIO()
        img.save(buf, format="PNG")
        out.append(buf.getvalue())

    if not out:
        # poppler returned no pages — an empty or unreadable document.
        raise PdfRenderError("This PDF has no readable pages.")

    return out


def split_to_image_bytes(path: str, mime: str) -> list[tuple[bytes, str]]:
    """Return a list of (image_bytes, mime) for any supported letter file.

    Single image files return a one-element list. PDFs return one element per
    rendered page (PNG).
    """
    if mime == "application/pdf" or path.lower().endswith(".pdf"):
        return [(b, "image/png") for b in pdf_to_image_bytes(path)]

    with open(path, "rb") as f:
        return [(f.read(), mime or "image/jpeg")]


def iter_data_urls(pages: Iterable[tuple[bytes, str]]) -> Iterable[dict]:
    """Yield OpenAI-compatible image content parts from (bytes, mime) tuples."""
    import base64

    for data, mime in pages:
        b64 = base64.b64encode(data).decode()
        yield {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}

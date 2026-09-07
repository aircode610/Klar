"""Regression tests for issue #8 — scanned PDFs with no text layer must NOT 500.

The reported crash happened when uploading a scanned, image-only PDF: the
extraction step raised a raw exception that bubbled up as a 500 instead of a
user-friendly error. These tests pin every extraction entry point to a typed,
graceful failure.
"""

import sys
import types
from uuid import uuid4

import pytest

from ai.react_agent.ocr import OcrError, _parse_ocr_response
from app.database import engine
from app.errors import ErrorCode
from app.models import Letter, LetterStatus
from app.pipeline import orchestrator
from app.services import extraction
from app.services.extraction import ExtractionError
from app.services.pdf_pages import PdfRenderError, pdf_to_image_bytes
from sqlmodel import Session


# --------------------------------------------------------------------------
# 1. ai/react_agent/ocr.py — malformed / blank OCR responses → OcrError
# --------------------------------------------------------------------------


def test_parse_ocr_response_happy_path():
    result = {"choices": [{"message": {"content": "Sehr geehrte Damen und Herren"}}]}
    assert _parse_ocr_response(result) == "Sehr geehrte Damen und Herren"


@pytest.mark.parametrize(
    "result",
    [
        "not a dict",
        {},
        {"choices": []},
        {"choices": [{}]},
        {"choices": [{"message": None}]},
        {"choices": [{"message": {"content": None}}]},
        {"choices": [{"message": {"content": "   "}}]},
    ],
)
def test_parse_ocr_response_malformed_raises_ocrerror(result):
    with pytest.raises(OcrError):
        _parse_ocr_response(result)


# --------------------------------------------------------------------------
# 2. pdf_pages.pdf_to_image_bytes — render failures → PdfRenderError
# --------------------------------------------------------------------------


def test_pdf_to_image_bytes_render_exception(monkeypatch):
    import pdf2image

    def _boom(*a, **k):
        raise RuntimeError("poppler exploded")

    monkeypatch.setattr(pdf2image, "convert_from_path", _boom)
    with pytest.raises(PdfRenderError):
        pdf_to_image_bytes("/tmp/whatever.pdf")


def test_pdf_to_image_bytes_zero_pages(monkeypatch):
    import pdf2image

    monkeypatch.setattr(pdf2image, "convert_from_path", lambda *a, **k: [])
    with pytest.raises(PdfRenderError):
        pdf_to_image_bytes("/tmp/empty.pdf")


# --------------------------------------------------------------------------
# 3. extraction.extract_from_letter_file — no tool call / empty pages
# --------------------------------------------------------------------------


class _FakeMessage:
    def __init__(self, tool_calls):
        self.tool_calls = tool_calls


class _FakeChoice:
    def __init__(self, tool_calls):
        self.message = _FakeMessage(tool_calls)


class _FakeResponse:
    def __init__(self, tool_calls):
        self.choices = [_FakeChoice(tool_calls)]


class _FakeCompletions:
    def __init__(self, tool_calls):
        self._tool_calls = tool_calls

    async def create(self, **kwargs):
        return _FakeResponse(self._tool_calls)


class _FakeClient:
    def __init__(self, tool_calls):
        self.chat = types.SimpleNamespace(completions=_FakeCompletions(tool_calls))


async def test_extract_from_letter_file_no_tool_call(monkeypatch):
    monkeypatch.setattr(
        extraction, "split_to_image_bytes", lambda p, m: [(b"\x89PNG", "image/png")]
    )
    monkeypatch.setattr(extraction.store, "search", lambda *a, **k: [])
    monkeypatch.setattr(extraction, "_get_client", lambda: _FakeClient(tool_calls=[]))

    with pytest.raises(ExtractionError):
        await extraction.extract_from_letter_file("/tmp/scan.pdf", "application/pdf")


async def test_extract_from_letter_file_empty_pages(monkeypatch):
    monkeypatch.setattr(extraction, "split_to_image_bytes", lambda p, m: [])
    with pytest.raises(ExtractionError):
        await extraction.extract_from_letter_file("/tmp/scan.pdf", "application/pdf")


# --------------------------------------------------------------------------
# 4. orchestrator._ocr_letter_file — handles PDFs + blank scans gracefully
# --------------------------------------------------------------------------


async def test_ocr_letter_file_image_blank(monkeypatch):
    async def _blank(path):
        return "   "

    monkeypatch.setattr("ai.react_agent.ocr.extract_text_from_image", _blank)
    with pytest.raises(ExtractionError):
        await orchestrator._ocr_letter_file("/tmp/photo.jpg")


async def test_ocr_letter_file_pdf_all_pages_blank(monkeypatch):
    monkeypatch.setattr(
        orchestrator, "pdf_to_image_bytes", lambda p, **k: [b"png1", b"png2"]
    )

    async def _blank(path):
        return ""

    monkeypatch.setattr("ai.react_agent.ocr.extract_text_from_image", _blank)
    with pytest.raises(ExtractionError):
        await orchestrator._ocr_letter_file("/tmp/scan.pdf")


async def test_ocr_letter_file_pdf_render_error_propagates(monkeypatch):
    def _boom(p, **k):
        raise PdfRenderError("corrupt")

    monkeypatch.setattr(orchestrator, "pdf_to_image_bytes", _boom)
    with pytest.raises(PdfRenderError):
        await orchestrator._ocr_letter_file("/tmp/scan.pdf")


async def test_ocr_letter_file_pdf_joins_pages(monkeypatch):
    monkeypatch.setattr(
        orchestrator, "pdf_to_image_bytes", lambda p, **k: [b"png1", b"png2"]
    )

    async def _ocr(path):
        return "page text"

    monkeypatch.setattr("ai.react_agent.ocr.extract_text_from_image", _ocr)
    text = await orchestrator._ocr_letter_file("/tmp/scan.pdf")
    assert text.count("page text") == 2


# --------------------------------------------------------------------------
# 5. Full SSE pipeline regression — scanned PDF yields a graceful `error`
#    event (NOT an unhandled 500) and marks the letter ERROR.
# --------------------------------------------------------------------------


def _install_fake_agent_module():
    """The orchestrator imports `ai.react_agent.agent` (which needs API keys
    to instantiate) before OCR runs. Inject a stub so the import guard passes
    without real credentials."""
    mod = types.ModuleType("ai.react_agent.agent")

    async def run_react_agent(ocr_text):  # pragma: no cover - never reached here
        if False:
            yield None

    mod.run_react_agent = run_react_agent
    sys.modules["ai.react_agent.agent"] = mod


async def test_process_letter_stream_scanned_pdf_emits_error(monkeypatch):
    _install_fake_agent_module()

    # Persist a letter pointing at a (notional) scanned PDF.
    with Session(engine) as db:
        letter = Letter(
            user_id=uuid4(),
            language="en",
            status=LetterStatus.UPLOADED,
            original_file="/tmp/scanned-no-text-layer.pdf",
        )
        db.add(letter)
        db.commit()
        db.refresh(letter)
        letter_id = letter.id

    # OCR can't read the scan → typed ExtractionError.
    async def _no_text(path):
        raise ExtractionError("scanned image without readable content")

    monkeypatch.setattr(orchestrator, "_ocr_letter_file", _no_text)

    events = [
        chunk async for chunk in orchestrator.process_letter_stream(letter_id, "en")
    ]
    blob = "".join(events)

    assert "event: error" in blob
    assert ErrorCode.EXTRACTION_FAILED.value in blob
    # The user-facing message is surfaced, not a stack trace / 500.
    assert "readable content" in blob

    with Session(engine) as db:
        refreshed = db.get(Letter, letter_id)
        assert refreshed.status == LetterStatus.ERROR


# --------------------------------------------------------------------------
# 6. Production POST /letters (public.py) — the exact `/api/letters` endpoint
#    named in the issue. A scanned/corrupt PDF must yield a typed 502 with the
#    right ErrorCode + user-facing message, NOT a raw 500.
# --------------------------------------------------------------------------


class _FakeUploadFile:
    """Minimal stand-in for fastapi.UploadFile for the upload handler."""

    def __init__(self, data: bytes, content_type: str):
        self._data = data
        self.content_type = content_type

    async def read(self) -> bytes:
        return self._data


def _make_user(db):
    from app.models import User

    user = User(email=f"scan-{uuid4()}@example.com", language="en")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


async def _call_post_letter(monkeypatch, *, raise_exc):
    """Drive public.post_letter with extraction stubbed to raise `raise_exc`.

    Returns the KlarHTTPException the handler raises (or None if it didn't).
    """
    from app.routers import public

    # A real PDF magic-number so the upload validation passes without poppler.
    monkeypatch.setattr(public, "detect_magic_mime", lambda data: "application/pdf")
    monkeypatch.setattr(
        public, "save_letter_file", lambda *a, **k: "/tmp/scanned-no-text.pdf"
    )

    async def _boom(*a, **k):
        raise raise_exc

    monkeypatch.setattr(public, "extract_from_letter_file", _boom)

    upload = _FakeUploadFile(b"%PDF-1.4 fake bytes", "application/pdf")

    with Session(engine) as db:
        user = _make_user(db)
        try:
            await public.post_letter(file=upload, lang="en", db=db, user=user)
        except Exception as exc:  # noqa: BLE001 — we assert on the typed error
            return exc
    return None


async def test_post_letter_scanned_pdf_returns_extraction_failed(monkeypatch):
    from app.errors import KlarHTTPException

    exc = await _call_post_letter(
        monkeypatch,
        raise_exc=ExtractionError("scanned image without readable content"),
    )
    assert isinstance(exc, KlarHTTPException)
    assert exc.status_code == 502
    assert exc.code == ErrorCode.EXTRACTION_FAILED
    assert "readable content" in exc.message


async def test_post_letter_corrupt_pdf_returns_pdf_render_failed(monkeypatch):
    from app.errors import KlarHTTPException

    exc = await _call_post_letter(
        monkeypatch,
        raise_exc=PdfRenderError("Could not render this PDF. It may be corrupt."),
    )
    assert isinstance(exc, KlarHTTPException)
    assert exc.status_code == 502
    # Distinct, actionable code (not lumped into the generic EXTRACTION_FAILED).
    assert exc.code == ErrorCode.PDF_RENDER_FAILED
    assert "corrupt" in exc.message


async def test_post_letter_unexpected_error_stays_generic(monkeypatch):
    from app.errors import KlarHTTPException

    exc = await _call_post_letter(
        monkeypatch, raise_exc=RuntimeError("some provider 500 with secrets")
    )
    assert isinstance(exc, KlarHTTPException)
    assert exc.status_code == 502
    assert exc.code == ErrorCode.EXTRACTION_FAILED
    # Raw provider error must NOT leak into the user-facing message.
    assert "secrets" not in exc.message


async def test_process_letter_stream_pdf_render_failure_emits_error(monkeypatch):
    _install_fake_agent_module()

    with Session(engine) as db:
        letter = Letter(
            user_id=uuid4(),
            language="en",
            status=LetterStatus.UPLOADED,
            original_file="/tmp/corrupt.pdf",
        )
        db.add(letter)
        db.commit()
        db.refresh(letter)
        letter_id = letter.id

    async def _render_fail(path):
        raise PdfRenderError("could not render this PDF")

    monkeypatch.setattr(orchestrator, "_ocr_letter_file", _render_fail)

    events = [
        chunk async for chunk in orchestrator.process_letter_stream(letter_id, "en")
    ]
    blob = "".join(events)

    assert "event: error" in blob
    assert ErrorCode.PDF_RENDER_FAILED.value in blob


# --------------------------------------------------------------------------
# 7. /api/letters/{id}/extract — the sync extract endpoint in letters.py must
#    log errors and return typed 502s, NOT silently swallow tracebacks.
# --------------------------------------------------------------------------


async def _call_extract_letter(monkeypatch, *, raise_exc):
    """Drive letters.extract_letter with extraction stubbed to raise `raise_exc`.

    Returns the KlarHTTPException the handler raises (or None if it didn't).
    """
    from app.routers import letters

    async def _boom(*a, **k):
        raise raise_exc

    monkeypatch.setattr(letters, "extract_from_letter_file", _boom)

    with Session(engine) as db:
        from app.models import User

        user = User(email=f"extract-{uuid4()}@example.com", language="en")
        db.add(user)
        db.commit()
        db.refresh(user)

        letter = Letter(
            user_id=user.id,
            language="en",
            status=LetterStatus.UPLOADED,
            original_file="/tmp/scanned.pdf",
        )
        db.add(letter)
        db.commit()
        db.refresh(letter)

        try:
            await letters.extract_letter(letter_id=letter.id, db=db, user=user)
        except Exception as exc:  # noqa: BLE001 — we assert on the typed error
            return exc
    return None


async def test_extract_letter_scanned_pdf_returns_extraction_failed(monkeypatch):
    from app.errors import KlarHTTPException

    exc = await _call_extract_letter(
        monkeypatch,
        raise_exc=ExtractionError("scanned image without readable content"),
    )
    assert isinstance(exc, KlarHTTPException)
    assert exc.status_code == 502
    assert exc.code == ErrorCode.EXTRACTION_FAILED
    assert "readable content" in exc.message


async def test_extract_letter_corrupt_pdf_returns_pdf_render_failed(monkeypatch):
    from app.errors import KlarHTTPException

    exc = await _call_extract_letter(
        monkeypatch,
        raise_exc=PdfRenderError("Could not render this PDF. It may be corrupt."),
    )
    assert isinstance(exc, KlarHTTPException)
    assert exc.status_code == 502
    assert exc.code == ErrorCode.PDF_RENDER_FAILED
    assert "corrupt" in exc.message


async def test_extract_letter_unexpected_error_stays_generic(monkeypatch):
    from app.errors import KlarHTTPException

    exc = await _call_extract_letter(
        monkeypatch, raise_exc=RuntimeError("some provider 500 with secrets")
    )
    assert isinstance(exc, KlarHTTPException)
    assert exc.status_code == 502
    assert exc.code == ErrorCode.EXTRACTION_FAILED
    # Raw provider error must NOT leak into the user-facing message.
    assert "secrets" not in exc.message

"""Regression tests for issue #8 — scanned, image-only PDFs must fail gracefully.

A scanned PDF with no readable text layer used to crash the letter pipeline
with a raw 500 (an unguarded ``RuntimeError`` when the vision model returned no
tool call). Both extraction paths must now surface a *user-facing* error:

- Sync path: ``app.services.extraction.extract_from_letter_file`` raises
  ``ExtractionError`` (carrying a Klar ``ErrorCode``), never a bare 500.
- SSE/OCR path: ``ai.react_agent.ocr.extract_text_from_image`` raises
  ``OcrError`` for a blank scan.
- SSE orchestrator (the production upload→process flow):
  ``app.pipeline.orchestrator.process_letter_stream`` turns that ``OcrError``
  into a graceful SSE ``error`` event (``PDF_RENDER_FAILED``) instead of a
  crashed stream / raw 500.

Pure stdlib ``unittest`` — no pytest dependency — so it runs anywhere with::

    python backend/tests/test_scanned_pdf_graceful.py
"""

import asyncio
import os
import sys
import types
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Make both `app.*` (backend) and `ai.*` (repo root) importable regardless of
# the directory the test is launched from.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_REPO_ROOT = os.path.dirname(_BACKEND_DIR)
for _p in (_BACKEND_DIR, _REPO_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from app.errors import ErrorCode  # noqa: E402
from app.services.extraction import (  # noqa: E402
    ExtractionError,
    extract_from_letter_file,
)
from ai.react_agent.ocr import OcrError, extract_text_from_image  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


def _response_with_tool_calls(tool_calls):
    """Build a minimal stand-in for an OpenAI chat-completions response."""
    message = MagicMock()
    message.tool_calls = tool_calls
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    return response


class SyncExtractionGracefulTest(unittest.TestCase):
    """Covers app/services/extraction.py — the /extract and POST /letters path."""

    @patch("app.services.extraction.store")
    @patch("app.services.extraction._get_client")
    @patch("app.services.extraction.split_to_image_bytes")
    def test_no_tool_call_raises_extraction_error(
        self, mock_split, mock_get_client, mock_store
    ):
        # PDF renders fine (scanned PDFs render like any other)...
        mock_split.return_value = [(b"fake-png-bytes", "image/png")]
        mock_store.search.return_value = []
        # ...but the vision model returns no structured tool call.
        fake_client = MagicMock()
        fake_client.chat.completions.create = AsyncMock(
            return_value=_response_with_tool_calls(None)
        )
        mock_get_client.return_value = fake_client

        with self.assertRaises(ExtractionError) as ctx:
            _run(extract_from_letter_file("/tmp/scan.pdf", "application/pdf"))

        self.assertEqual(ctx.exception.code, ErrorCode.EXTRACTION_FAILED)
        self.assertTrue(str(ctx.exception))
        # The old behavior raised a bare RuntimeError; guard against regressing.
        self.assertNotIsInstance(ctx.exception, RuntimeError)

    @patch("app.services.extraction.split_to_image_bytes")
    def test_empty_render_raises_pdf_render_failed(self, mock_split):
        mock_split.return_value = []  # no pages produced

        with self.assertRaises(ExtractionError) as ctx:
            _run(extract_from_letter_file("/tmp/empty.pdf", "application/pdf"))

        self.assertEqual(ctx.exception.code, ErrorCode.PDF_RENDER_FAILED)

    @patch(
        "app.services.extraction.split_to_image_bytes",
        side_effect=RuntimeError("poppler exploded"),
    )
    def test_render_crash_is_wrapped_as_pdf_render_failed(self, _mock_split):
        with self.assertRaises(ExtractionError) as ctx:
            _run(extract_from_letter_file("/tmp/corrupt.pdf", "application/pdf"))

        self.assertEqual(ctx.exception.code, ErrorCode.PDF_RENDER_FAILED)


class OcrPathGracefulTest(unittest.TestCase):
    """Covers ai/react_agent/ocr.py — the SSE /process pipeline path."""

    @patch("ai.react_agent.ocr._ocr_image_bytes", new_callable=AsyncMock)
    @patch("ai.react_agent.ocr._pdf_to_png_bytes")
    def test_blank_scan_raises_ocr_error(self, mock_pdf, mock_ocr):
        mock_pdf.return_value = [b"fake-png-bytes"]
        mock_ocr.return_value = "   \n  "  # whitespace only == no readable text

        with self.assertRaises(OcrError):
            _run(extract_text_from_image("/tmp/scan.pdf"))

    @patch("ai.react_agent.ocr._ocr_image_bytes", new_callable=AsyncMock)
    @patch("builtins.open")
    def test_blank_image_raises_ocr_error(self, mock_open, mock_ocr):
        # Symmetric with the PDF branch: a scanned/blank single image with no
        # readable text must also fail gracefully rather than feeding empty
        # OCR text to the downstream agent.
        mock_open.return_value.__enter__.return_value.read.return_value = b"img-bytes"
        mock_ocr.return_value = ""  # no readable text

        with self.assertRaises(OcrError):
            _run(extract_text_from_image("/tmp/scan.jpg"))

    def test_malformed_ocr_response_raises_ocr_error(self):
        # A 200 OK with an unexpected JSON shape (no choices) must surface as a
        # graceful OcrError, never a raw KeyError/IndexError 500.
        from ai.react_agent.ocr import _ocr_image_bytes

        fake_response = MagicMock()
        fake_response.raise_for_status = MagicMock()
        fake_response.json.return_value = {"error": "quota exceeded"}  # no "choices"
        fake_client = MagicMock()
        fake_client.post = AsyncMock(return_value=fake_response)

        with self.assertRaises(OcrError):
            _run(_ocr_image_bytes(fake_client, b"img-bytes", "image/png"))


class OrchestratorSsePathTest(unittest.TestCase):
    """Covers app/pipeline/orchestrator.py — the SSE /process production path.

    In production, issue #8 is served by the SSE pipeline: a scanned image-only
    PDF makes the OCR stage (``extract_text_from_image``) raise ``OcrError``.
    The orchestrator MUST turn that into a graceful SSE ``error`` event
    (``PDF_RENDER_FAILED``) — never let it propagate as a crashed stream / raw
    500. The leaf-function tests above never exercise this wiring, so a refactor
    of the orchestrator's catch block could silently reintroduce the 500.
    """

    @staticmethod
    def _drain(gen):
        async def _collect():
            return [event async for event in gen]

        return _run(_collect())

    def test_ocr_error_becomes_graceful_sse_error_event(self):
        from uuid import uuid4

        import ai.react_agent.ocr as ocr_mod
        from app.pipeline import orchestrator

        # Stub the heavy agent module so the orchestrator's lazy
        # `from ai.react_agent.agent import run_react_agent` import succeeds
        # without pulling in the langchain/Tavily stack.
        agent_stub = types.ModuleType("ai.react_agent.agent")
        agent_stub.run_react_agent = lambda *a, **k: None  # never reached here

        # A fake Letter row with a file set, so we reach the OCR stage.
        fake_letter = MagicMock()
        fake_letter.original_file = "/tmp/scan.pdf"

        fake_db = MagicMock()
        fake_db.get.return_value = fake_letter
        db_cm = MagicMock()
        db_cm.__enter__.return_value = fake_db
        db_cm.__exit__.return_value = False

        with (
            patch.dict(sys.modules, {"ai.react_agent.agent": agent_stub}),
            patch.object(
                ocr_mod,
                "extract_text_from_image",
                new=AsyncMock(side_effect=OcrError("scanned PDF, no text layer")),
            ),
            patch.object(orchestrator, "DBSession", return_value=db_cm),
        ):
            events = self._drain(orchestrator.process_letter_stream(uuid4(), "en"))

        # The stream must terminate with exactly one graceful error event —
        # the generator must NOT raise.
        error_events = [e for e in events if e.startswith("event: error")]
        self.assertEqual(len(error_events), 1, f"events were: {events!r}")
        payload = error_events[0]
        # OcrError → PDF_RENDER_FAILED, carrying the user-facing message.
        self.assertIn(ErrorCode.PDF_RENDER_FAILED.value, payload)
        self.assertIn("scanned PDF, no text layer", payload)
        # Regression guard: never the bare generic code on a known OcrError.
        self.assertNotIn("event: ocr_result", "".join(events))


if __name__ == "__main__":
    unittest.main(verbosity=2)

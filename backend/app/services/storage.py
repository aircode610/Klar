"""Local-disk storage for uploaded letters.

Files land at: {upload_dir}/{user_id}/{letter_id}.{ext}

Atomic write via NamedTemporaryFile + rename, so partial uploads never leave
half-written files behind.
"""

import os
import tempfile
from pathlib import Path
from uuid import UUID

from app.config import settings


def _ext_from_mime(mime: str) -> str:
    mime = (mime or "").lower()
    if mime == "image/jpeg":
        return "jpg"
    if mime == "image/png":
        return "png"
    if mime == "image/heic":
        return "heic"
    if mime == "image/webp":
        return "webp"
    if mime == "application/pdf":
        return "pdf"
    return "bin"


def user_dir(user_id: UUID) -> Path:
    p = Path(settings.upload_dir) / str(user_id)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_letter_file(user_id: UUID, letter_id: UUID, mime: str, data: bytes) -> str:
    """Write `data` to disk atomically; return the absolute path string."""
    ext = _ext_from_mime(mime)
    target_dir = user_dir(user_id)
    target_path = target_dir / f"{letter_id}.{ext}"

    fd, tmp_path = tempfile.mkstemp(prefix=".upload-", dir=str(target_dir))
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp_path, target_path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    return str(target_path.resolve())


def is_pdf(path: str) -> bool:
    return path.lower().endswith(".pdf")


def detect_magic_mime(data: bytes) -> str | None:
    """Return the MIME type implied by file magic bytes, or None if unrecognized.

    Defends against clients that lie in the multipart Content-Type header
    (e.g. uploading a binary with `Content-Type: image/jpeg`). Only the
    formats Klar actually accepts are recognized.
    """
    if not data:
        return None
    head = data[:16]
    if head[:4] == b"%PDF":
        return "application/pdf"
    if head[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if head[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    # HEIC: ftyp box at offset 4 with brand 'heic' / 'heix' / 'hevc' / 'mif1'
    if head[4:8] == b"ftyp" and head[8:12] in (b"heic", b"heix", b"hevc", b"mif1"):
        return "image/heic"
    return None

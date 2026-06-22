"""Shared pytest setup for backend tests.

Sets up an isolated SQLite DB and makes the repo-root `ai/` package importable
(the production code does the same in `app.main._ensure_ai_package_importable`)
BEFORE any `app.*` module is imported, so module-level `create_engine` and
`from ai... import` calls resolve against the test environment.
"""

import os
import sys
import tempfile
from pathlib import Path

# --- make the repo root importable so `import ai...` works in tests ---
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# --- isolate the DB to a throwaway file before app.database is imported ---
_TMP_DB = Path(tempfile.gettempdir()) / "klar_test.db"
if _TMP_DB.exists():
    _TMP_DB.unlink()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_TMP_DB}")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-32")

import pytest  # noqa: E402

from app.database import engine, init_db  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    init_db()
    yield
    engine.dispose()
    if _TMP_DB.exists():
        _TMP_DB.unlink()

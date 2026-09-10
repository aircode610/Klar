"""Tests for GET /api/health — success and DB-failure paths.

Deliberately mounts only the health router on a throwaway FastAPI app
(instead of the full `app.main.app`) so this test doesn't pull in ChromaDB /
LangChain import-time side effects that belong to unrelated routers.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import health as health_module


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(health_module.router)
    return TestClient(app)


def test_get_api_health_returns_200_with_expected_shape():
    resp = _client().get("/api/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["version"] == health_module.VERSION
    assert body["db"] == "ok"


def test_get_api_health_reports_db_fail_on_exception(monkeypatch):
    class _BoomSession:
        def __init__(self, *_a, **_k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

        def exec(self, *_a, **_k):
            raise RuntimeError("database is unreachable")

    monkeypatch.setattr(health_module, "Session", _BoomSession)

    resp = _client().get("/api/health")

    # Per CRITERIA/PLAN: the endpoint itself still returns 200; only the
    # `db` field flips to "fail" — it does not surface as an HTTP error.
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "fail"

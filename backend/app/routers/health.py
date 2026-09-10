"""GET /api/health — liveness + DB connectivity check."""

from fastapi import APIRouter
from sqlalchemy import text
from sqlmodel import Session

from app.config import VERSION
from app.database import engine

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    db_status = "ok"
    try:
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
    except Exception:
        db_status = "fail"
    return {"status": "ok", "version": VERSION, "db": db_status}

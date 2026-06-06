"""Routers package — one module per FastAPI router."""

from app.routers import actions, deadlines, letters, rag

__all__ = ["actions", "deadlines", "letters", "rag"]

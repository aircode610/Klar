"""Klar — FastAPI entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router  # APIRouter (re-exported)
from app.config import settings
from app.database import init_db
from app.errors import (
    KlarHTTPException,
    generic_http_exception_handler,
    klar_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.rag.store import init_chroma
from app.routers import actions, deadlines, letters, rag  # router modules


def _validate_production_security() -> None:
    """Fail fast in production if security-sensitive defaults haven't been set."""
    if settings.app_env != "production":
        return
    if not settings.cookie_secure:
        raise RuntimeError(
            "COOKIE_SECURE must be true when APP_ENV=production "
            "(session cookies must only travel over HTTPS)"
        )
    if settings.dev_auth_expose_reset_token:
        raise RuntimeError(
            "DEV_AUTH_EXPOSE_RESET_TOKEN must be false in production "
            "(reset tokens must be delivered out-of-band via email, not the API response)"
        )
    if settings.jwt_secret.startswith(("dev-only", "change-me")):
        raise RuntimeError(
            "JWT_SECRET must be set to a random 32+ byte value in production"
        )
    if not settings.allowed_origins_list:
        raise RuntimeError(
            "ALLOWED_ORIGINS must be set in production (cookies require credentialed CORS)"
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    _validate_production_security()
    init_db()
    init_chroma()
    yield


app = FastAPI(
    title="Klar API",
    description="German bureaucratic mail → structured obligations + deadlines.",
    version="0.1.0",
    lifespan=lifespan,
)

# Cookies require credentials=True and a concrete allowed-origin list (no '*').
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Order matters: KlarHTTPException must be checked before generic HTTPException.
app.add_exception_handler(KlarHTTPException, klar_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, generic_http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(auth_router)
app.include_router(letters.router)
app.include_router(actions.router)
app.include_router(deadlines.router)
app.include_router(rag.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "klar",
        "model": settings.effective_llm_model,
    }

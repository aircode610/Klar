"""Authentication subsystem.

Public surface:
    - router            — FastAPI APIRouter for /api/auth/*
    - get_current_user  — dependency: resolve User from session cookie or 401
    - get_current_user_optional — same, returns None instead of 401
    - hash_password / verify_password — bcrypt helpers
    - DUMMY_PASSWORD_HASH — precomputed hash for constant-time login
    - session_expiry / reset_token_expiry — TTL helpers
    - generate_session_token / generate_reset_token — opaque random tokens
"""

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.auth.router import router
from app.auth.utils import (
    DUMMY_PASSWORD_HASH,
    generate_reset_token,
    generate_session_token,
    hash_password,
    reset_token_expiry,
    session_expiry,
    verify_password,
)

__all__ = [
    "router",
    "get_current_user",
    "get_current_user_optional",
    "DUMMY_PASSWORD_HASH",
    "generate_reset_token",
    "generate_session_token",
    "hash_password",
    "reset_token_expiry",
    "session_expiry",
    "verify_password",
]

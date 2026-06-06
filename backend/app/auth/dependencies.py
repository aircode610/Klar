"""FastAPI dependency that resolves the current user from the session cookie."""

from datetime import datetime

from fastapi import Depends, Request, status
from sqlmodel import Session as DBSession, select

from app.config import settings
from app.database import get_session
from app.errors import ErrorCode, KlarHTTPException
from app.models import Session, User, utcnow


def _resolve_user(token: str | None, db: DBSession) -> User:
    if not token:
        raise KlarHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=ErrorCode.AUTH_NOT_AUTHENTICATED,
            headers={"WWW-Authenticate": "Cookie"},
        )

    stmt = select(Session).where(Session.token == token)
    session_row = db.scalars(stmt).first()

    if session_row is None or session_row.expires_at < utcnow():
        raise KlarHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=ErrorCode.AUTH_SESSION_EXPIRED,
        )

    user = db.get(User, session_row.user_id)
    if user is None:
        raise KlarHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=ErrorCode.AUTH_SESSION_EXPIRED,
        )

    # Sliding-update last-seen (does NOT extend expiry).
    session_row.last_seen_at = utcnow()
    db.add(session_row)
    db.commit()
    return user


def get_current_user(request: Request, db: DBSession = Depends(get_session)) -> User:
    """Resolve the user from the session cookie. Raises 401 if unauthenticated."""
    token = request.cookies.get(settings.cookie_name)
    return _resolve_user(token, db)


def get_current_user_optional(
    request: Request,
    db: DBSession = Depends(get_session),
) -> User | None:
    """Same as get_current_user but returns None instead of raising 401."""
    token = request.cookies.get(settings.cookie_name)
    if not token:
        return None
    try:
        return _resolve_user(token, db)
    except KlarHTTPException:
        return None

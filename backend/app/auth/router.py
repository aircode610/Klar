"""Authentication routes: signup, login, logout, me, forgot/reset password."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlmodel import Session as DBSession, select

from app.auth.dependencies import get_current_user
from app.auth.utils import (
    DUMMY_PASSWORD_HASH,
    generate_reset_token,
    generate_session_token,
    hash_password,
    reset_token_expiry,
    session_expiry,
    verify_password,
)
from app.config import settings
from app.database import get_session
from app.models import PasswordResetToken, Session, User, utcnow

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- request / response models ----------


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    language: str = Field(default="en", max_length=8)

    @field_validator("language")
    @classmethod
    def normalize_language(cls, v: str) -> str:
        return v.strip().lower()[:8] or "en"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class ForgotRequest(BaseModel):
    email: EmailStr


class ResetRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class UserOut(BaseModel):
    id: str
    email: EmailStr
    language: str
    timezone: str
    created_at: datetime


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        language=user.language,
        timezone=user.timezone,
        created_at=user.created_at,
    )


# ---------- cookie helpers ----------


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.cookie_name,
        path="/",
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        httponly=True,
    )


def _issue_session(
    db: DBSession, user: User, request: Request, response: Response
) -> str:
    token = generate_session_token()
    sess = Session(
        user_id=user.id,
        token=token,
        expires_at=session_expiry(),
        user_agent=(request.headers.get("user-agent") or "")[:255],
        ip_address=(request.client.host if request.client else "")[:64],
    )
    db.add(sess)
    db.commit()
    _set_session_cookie(response, token)
    return token


# ---------- endpoints ----------


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(
    payload: SignupRequest,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_session),
):
    existing = db.scalars(select(User).where(User.email == payload.email)).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        language=payload.language,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _issue_session(db, user, request, response)
    return {"user": _user_out(user)}


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_session),
):
    user = db.scalars(select(User).where(User.email == payload.email)).first()
    # Constant-time: always run a full bcrypt verify against either the real
    # stored hash or a precomputed valid hash (DUMMY_PASSWORD_HASH). This
    # prevents user enumeration via response-time side channel.
    is_valid = verify_password(
        payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH
    )
    if not user or not is_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    _issue_session(db, user, request, response)
    return {"user": _user_out(user)}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: DBSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    token = request.cookies.get(settings.cookie_name)
    if token:
        sess = db.scalars(select(Session).where(Session.token == token)).first()
        if sess is not None:
            db.delete(sess)
            db.commit()
    _clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"user": _user_out(user)}


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotRequest,
    db: DBSession = Depends(get_session),
):
    user = db.scalars(select(User).where(User.email == payload.email)).first()

    # Always respond identically — never reveal whether an email is registered.
    body: dict = {
        "ok": True,
        "message": "If that email is registered, a reset link has been sent.",
    }

    if user is None:
        return body

    token_value = generate_reset_token()
    reset = PasswordResetToken(
        user_id=user.id, token=token_value, expires_at=reset_token_expiry()
    )
    db.add(reset)
    db.commit()

    # TODO(prod): send via email. For dev/hackathon expose the token so the
    # frontend can be tested end-to-end without an SMTP setup.
    if settings.dev_auth_expose_reset_token:
        body["dev_reset_token"] = token_value
        body["dev_expires_at"] = reset.expires_at.isoformat()

    return body


@router.post("/reset-password")
def reset_password(
    payload: ResetRequest,
    response: Response,
    db: DBSession = Depends(get_session),
):
    reset = db.scalars(
        select(PasswordResetToken).where(PasswordResetToken.token == payload.token)
    ).first()

    if reset is None or reset.used_at is not None:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    if reset.expires_at < utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    user = db.get(User, reset.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid token")

    user.password_hash = hash_password(payload.new_password)
    reset.used_at = utcnow()
    db.add(user)
    db.add(reset)

    # Invalidate all existing sessions for this user (security: password rotation
    # should kick out every device).
    sessions = db.scalars(select(Session).where(Session.user_id == user.id)).all()
    for sess in sessions:
        db.delete(sess)

    db.commit()
    _clear_session_cookie(response)
    return {"ok": True}

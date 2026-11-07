import hashlib
from collections.abc import Iterator
from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.exceptions import AuthenticationFailed, PermissionDenied
from app.core.security import SESSION_COOKIE, SlidingLimiter, csrf_matches, decode_session
from app.models import AdminUser
from app.services.chat_service import ChatLLM
from app.services.email_service import Provider


@dataclass
class Container:
    settings: Settings
    engine: Engine
    session_factory: sessionmaker[Session]
    llm: ChatLLM
    email: Provider | None
    login_limiter: SlidingLimiter
    chat_limiter: SlidingLimiter
    contact_limiter: SlidingLimiter


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_db(c: Container = Depends(get_container)) -> Iterator[Session]:
    s = c.session_factory()
    try:
        yield s
    finally:
        s.close()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def ip_hash(settings: Settings, ip: str) -> str:
    return hashlib.sha256(f"{settings.secret_key}|{ip}".encode()).hexdigest()


SAFE = {"GET", "HEAD", "OPTIONS"}


def get_admin(request: Request, db: Session = Depends(get_db), c: Container = Depends(get_container)) -> AdminUser:
    """Cookie session + CSRF (header must equal the value embedded in the signed session). Enforced on EVERY admin route."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise AuthenticationFailed("Authentication required")
    claims = decode_session(c.settings, token)
    if request.method not in SAFE and not csrf_matches(claims["csrf"], request.headers.get("x-csrf-token")):
        raise PermissionDenied("Missing or invalid CSRF token")
    admin = db.get(AdminUser, claims["sub"])
    if admin is None or not admin.is_active:
        raise AuthenticationFailed("Session is no longer valid")
    request.state.csrf = claims["csrf"]
    return admin


Admin = Depends(get_admin)

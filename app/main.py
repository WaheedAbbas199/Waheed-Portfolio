"""FastAPI application: JSON API + public site + admin SPA (same origin so admin cookies are SameSite=Strict)."""

import html
import re
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.dependencies import Container, get_container, get_db
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging, get_logger, request_id_var
from app.core.security import SlidingLimiter
from app.db.base import Base
from app.db.session import make_engine, make_session_factory
from app.services import chat_service, content_service, email_service, media_service
from app.services.seed import seed_defaults

log = get_logger(__name__)
ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR, ADMIN_DIR = ROOT / "public", ROOT / "admin"
CSP_PUBLIC = (
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; "
    "media-src 'self'; frame-src 'self'; object-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:"
)
CSP_ADMIN = (
    CSP_PUBLIC.replace("frame-src 'self'; ", "")
    .replace("frame-ancestors 'self'", "frame-ancestors 'none'")
    .replace("object-src 'self'", "object-src 'none'")
)


def build_container(settings: Settings, *, llm=None, email="auto", create_tables: bool = False) -> Container:
    engine = make_engine(settings)
    if create_tables:
        import app.models  # noqa: F401

        Base.metadata.create_all(engine)
    return Container(
        settings=settings,
        engine=engine,
        session_factory=make_session_factory(engine),
        llm=llm or chat_service.build_llm(settings),
        email=email_service.build_provider(settings) if email == "auto" else email,
        login_limiter=SlidingLimiter(settings.login_max_attempts, settings.login_window_seconds, "Too many failed login attempts. Try again later."),
        chat_limiter=SlidingLimiter(settings.chat_rate_per_minute, 60, "You're sending messages too quickly. Please wait a moment."),
        contact_limiter=SlidingLimiter(settings.contact_rate_per_hour, 3600, "Too many messages from this connection. Please try again later."),
    )


def _render_index(session: Session, settings: Settings) -> str:
    seo = content_service.get_group(session, "seo")
    base = settings.site_url.rstrip("/")
    img = content_service.media_url(session, seo.get("og_image_id"))
    e = html.escape
    meta = [
        f"<title>{e(seo['title'])}</title>",
        f'<meta name="description" content="{e(seo["description"])}">',
        f'<meta name="keywords" content="{e(seo["keywords"])}">',
        f'<link rel="canonical" href="{e(base)}/">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{e(seo["title"])}">',
        f'<meta property="og:description" content="{e(seo["description"])}">',
        f'<meta property="og:url" content="{e(base)}/">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if img:
        meta.append(f'<meta property="og:image" content="{e(base + img)}">')
    template = (PUBLIC_DIR / "index.html").read_text(encoding="utf-8")
    return re.sub(r"<!--SEO_META-->", "\n  ".join(meta), template)


def create_app(settings: Settings | None = None, *, container: Container | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_json)
    container = container or build_container(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        with container.session_factory() as s:
            seed_defaults(s)
        log.info(
            "startup complete (env=%s, ai=%s, email=%s)", settings.app_env, container.llm.name, settings.email_provider if container.email else "off"
        )
        yield

    app = FastAPI(
        title="Waheed Abbas Portfolio API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/api/v1/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/api/v1/openapi.json",
    )
    app.state.container = container
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"]
    )

    @app.middleware("http")
    async def context_and_headers(request: Request, call_next):
        rid = request.headers.get("x-request-id", "")[:64] or uuid.uuid4().hex[:16]
        tok = request_id_var.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(tok)
        path = request.url.path
        response.headers["X-Request-ID"] = rid
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=(self)"
        if not path.startswith("/api/v1/docs") and "content-security-policy" not in response.headers:  # media route sets a stricter sandbox CSP
            response.headers["Content-Security-Policy"] = CSP_ADMIN if path.startswith(("/admin", "/api/v1/admin")) else CSP_PUBLIC
        response.headers["X-Frame-Options"] = "DENY" if path.startswith(("/admin", "/api/v1/admin")) else "SAMEORIGIN"
        if path.startswith(("/admin", "/api/v1/admin")):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Robots-Tag"] = "noindex, nofollow"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    def envelope(status: int, code: str, message: str, details=None) -> JSONResponse:
        return JSONResponse(
            status_code=status, content={"error": {"code": code, "message": message, "details": details, "request_id": request_id_var.get()}}
        )

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return envelope(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        details = [{"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": e["msg"]} for e in exc.errors()]
        return envelope(422, "validation_failed", "Please check the highlighted fields.", details)

    @app.exception_handler(ValidationError)
    async def _model_validation(_: Request, exc: ValidationError):  # settings groups are validated inside services
        details = [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()]
        return envelope(422, "validation_failed", "Please check the highlighted fields.", details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        return envelope(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("Unhandled error: %s", type(exc).__name__)
        return envelope(500, "internal_error", "Something went wrong on the server.")

    app.include_router(api_router, prefix="/api/v1")

    @app.get("/media/{stored_name}", include_in_schema=False)
    def media(stored_name: str, db: Session = Depends(get_db)):
        asset = media_service.get_by_stored_name(db, stored_name)
        disposition = "inline" if asset.mime.startswith("image/") or asset.mime == "application/pdf" else "attachment"
        return Response(
            asset.data,
            media_type=asset.mime,
            headers={
                "Cache-Control": "public, max-age=86400",
                "Content-Disposition": f'{disposition}; filename="{asset.original_name}"',
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'none'; sandbox",
            },
        )

    @app.get("/robots.txt", include_in_schema=False)
    def robots(c: Container = Depends(get_container)):
        return PlainTextResponse(
            f"User-agent: *\nDisallow: /admin\nDisallow: /api/v1/admin\nSitemap: {c.settings.site_url.rstrip('/')}/sitemap.xml\n"
        )

    @app.get("/sitemap.xml", include_in_schema=False)
    def sitemap(c: Container = Depends(get_container)):
        base = c.settings.site_url.rstrip("/")
        return Response(
            f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{html.escape(base)}/</loc></url></urlset>',
            media_type="application/xml",
        )

    @app.get("/", include_in_schema=False)
    def index(db: Session = Depends(get_db), c: Container = Depends(get_container)):
        return HTMLResponse(_render_index(db, c.settings), headers={"Cache-Control": "public, max-age=60"})

    @app.get("/admin", include_in_schema=False)
    def admin_index():
        return FileResponse(ADMIN_DIR / "index.html")

    app.mount("/admin/", StaticFiles(directory=ADMIN_DIR, html=True), name="admin")
    app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")
    return app


def __getattr__(name: str):
    if name == "app":
        return create_app()
    raise AttributeError(name)

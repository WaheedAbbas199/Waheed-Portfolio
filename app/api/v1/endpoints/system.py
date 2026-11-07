from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import Container, get_container, get_db

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/ready")
def ready(db: Session = Depends(get_db), c: Container = Depends(get_container)):
    try:
        db.execute(text("SELECT 1"))
        ok = True
    except Exception:  # noqa: BLE001
        ok = False
    body = {
        "status": "ready" if ok else "degraded",
        "database": "ok" if ok else "unavailable",
        "ai": "configured" if c.llm.name != "disabled" else "not_configured",
        "email": c.settings.email_provider if c.email else "not_configured",
    }
    return body if ok else JSONResponse(status_code=503, content=body)

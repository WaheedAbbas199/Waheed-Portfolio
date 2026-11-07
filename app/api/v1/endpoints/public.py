import hashlib
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import Container, client_ip, get_container, get_db, ip_hash
from app.core.exceptions import ValidationFailed
from app.db.base import utcnow
from app.models import ContactMessage
from app.models.enums import EmailStatus
from app.schemas.admin import ChatIn, ContactIn
from app.services import chat_service, content_service, email_service
from app.services.audit_service import audit

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/site")
def site(response: Response, db: Session = Depends(get_db)) -> dict:
    response.headers["Cache-Control"] = "public, max-age=60"
    return content_service.public_bundle(db)


@router.get("/projects/{slug}")
def project(slug: str, response: Response, db: Session = Depends(get_db)) -> dict:
    response.headers["Cache-Control"] = "public, max-age=60"
    return content_service.public_project(db, slug)


@router.get("/chat/config")
def chat_config(c: Container = Depends(get_container), db: Session = Depends(get_db)) -> dict:
    cfg = content_service.get_group(db, "chatbot")
    return {**cfg, "ai_available": c.llm.name != "disabled"}


@router.post("/chat")
def chat(body: ChatIn, request: Request, c: Container = Depends(get_container), db: Session = Depends(get_db)) -> dict:
    c.chat_limiter.check_and_hit(ip_hash(c.settings, client_ip(request)))
    res = chat_service.answer(db, c.settings, c.llm, question=body.message, history=[t.model_dump() for t in body.history])
    return {"answer": res.answer, "mode": res.mode, "sources": res.sources}


def _notify_task(c: Container, message_id: str) -> None:
    with c.session_factory() as s:
        email_service.send_notification(s, c.settings, c.email, message_id)


@router.post("/contact", status_code=201)
def contact(
    body: ContactIn, request: Request, background: BackgroundTasks, c: Container = Depends(get_container), db: Session = Depends(get_db)
) -> dict:
    iph = ip_hash(c.settings, client_ip(request))
    if body.website:  # honeypot tripped: pretend success, store nothing
        return {"status": "received", "id": "ignored", "notification": "not_applicable"}
    c.contact_limiter.check_and_hit(iph)
    cats = content_service.get_group(db, "contact")["categories"]
    if body.category not in cats:
        raise ValidationFailed(
            "Please choose one of the listed inquiry categories.", details=[{"field": "category", "message": f"must be one of {cats}"}]
        )
    if 0 < body.elapsed_ms < 2000:
        raise ValidationFailed("That was very fast. Please review your message and try again.")
    dedupe = hashlib.sha256(f"{body.email.lower()}|{body.message}".encode()).hexdigest()
    recent = db.scalar(
        select(ContactMessage).where(ContactMessage.dedupe_hash == dedupe, ContactMessage.created_at >= utcnow() - timedelta(minutes=10))
    )
    if recent:  # double-click / retry: same message, no duplicate row, no second notification
        return {"status": "received", "id": recent.id, "notification": recent.email_status.value}
    msg = ContactMessage(
        name=body.name,
        email=body.email.lower(),
        category=body.category,
        subject=body.subject,
        message=body.message,
        dedupe_hash=dedupe,
        ip_hash=iph,
        email_status=EmailStatus.PENDING if c.email else EmailStatus.DISABLED,
    )
    db.add(msg)
    audit(db, actor_id=None, action="contact.received", entity_type="contact_message", entity_id=msg.id, details={"category": body.category})
    db.commit()
    if c.email:
        background.add_task(_notify_task, c, msg.id)
    # We confirm that the message was SAVED. We never claim an email was delivered.
    return {"status": "received", "id": msg.id, "notification": msg.email_status.value}

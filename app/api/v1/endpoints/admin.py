from datetime import timedelta

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import Admin, Container, client_ip, get_container, get_db
from app.core.exceptions import AuthenticationFailed, ConflictError, NotFoundError, ValidationFailed
from app.core.security import CSRF_COOKIE, SESSION_COOKIE, hash_password, new_session_token, verify_password
from app.db.base import utcnow
from app.models import AdminUser, AuditLog, ChatUsageEvent, ContactMessage, EmailAttempt, MediaAsset, ProfileItem, Project, Skill
from app.models.enums import EmailStatus, MediaKind, MessageStatus
from app.schemas.admin import ItemIn, ItemOut, LoginIn, MessageStatusIn, ProjectIn, ProjectOut, ReorderIn, SkillIn, SkillOut
from app.schemas.settings import GROUPS
from app.services import content_service, email_service, media_service
from app.services.audit_service import audit

router = APIRouter(prefix="/admin", tags=["admin"])
_DUMMY = hash_password("Dummy-password-123")


# ------------------------------- auth -------------------------------
def _set_cookie(c: Container, response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token, httponly=True, secure=c.settings.is_production, samesite="strict", max_age=c.settings.session_hours * 3600, path="/"
    )
    response.delete_cookie(CSRF_COOKIE, path="/")


@router.post("/auth/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db), c: Container = Depends(get_container)) -> dict:
    key = f"{client_ip(request)}|{body.email.lower()}"
    c.login_limiter.check(key)
    admin = db.scalar(select(AdminUser).where(AdminUser.email == body.email.lower()))
    ok = verify_password(body.password, admin.password_hash if admin else _DUMMY)  # constant-ish time for unknown users
    if not admin or not ok or not admin.is_active:
        c.login_limiter.hit(key)
        audit(db, actor_id=admin.id if admin else None, action="auth.login_failed", entity_type="admin", details={})
        db.commit()
        raise AuthenticationFailed("Invalid email or password")
    c.login_limiter.reset(key)
    admin.last_login_at = utcnow()
    audit(db, actor_id=admin.id, action="auth.login", entity_type="admin", entity_id=admin.id)
    db.commit()
    token, csrf = new_session_token(c.settings, admin.id)
    _set_cookie(c, response, token)
    return {"email": admin.email, "csrf": csrf, "expires_in": c.settings.session_hours * 3600}


@router.post("/auth/logout", status_code=204)
def logout(response: Response, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    audit(db, actor_id=admin.id, action="auth.logout", entity_type="admin", entity_id=admin.id)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/auth/me")
def me(request: Request, admin: AdminUser = Admin) -> dict:
    return {"email": admin.email, "csrf": request.state.csrf}


# ------------------------------- dashboard -------------------------------
@router.get("/dashboard")
def dashboard(_: AdminUser = Admin, db: Session = Depends(get_db), c: Container = Depends(get_container)) -> dict:
    def count(model, *where) -> int:
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    now = utcnow()
    recent = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10))
    return {
        "projects_published": count(Project, Project.published.is_(True)),
        "projects_draft": count(Project, Project.published.is_(False)),
        "messages_total": count(ContactMessage),
        "messages_unread": count(ContactMessage, ContactMessage.status == MessageStatus.UNREAD),
        "email_failed": count(ContactMessage, ContactMessage.email_status == EmailStatus.FAILED),
        "chat_7d": count(ChatUsageEvent, ChatUsageEvent.created_at >= now - timedelta(days=7)),
        "chat_30d": count(ChatUsageEvent, ChatUsageEvent.created_at >= now - timedelta(days=30)),
        "chat_errors_30d": count(ChatUsageEvent, ChatUsageEvent.created_at >= now - timedelta(days=30), ChatUsageEvent.error_code.is_not(None)),
        "chat_basic_30d": count(ChatUsageEvent, ChatUsageEvent.created_at >= now - timedelta(days=30), ChatUsageEvent.mode == "basic"),
        "config": {"ai_configured": c.llm.name != "disabled", "email_provider": c.settings.email_provider, "email_configured": c.email is not None},
        "recent_activity": [{"action": a.action, "entity": a.entity_type, "at": a.created_at.isoformat()} for a in recent],
    }


@router.get("/audit")
def audit_log(_: AdminUser = Admin, db: Session = Depends(get_db), page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100)) -> dict:
    total = db.scalar(select(func.count()).select_from(AuditLog)) or 0
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(page_size).offset((page - 1) * page_size))
    return {
        "total": total,
        "items": [
            {"action": a.action, "entity_type": a.entity_type, "entity_id": a.entity_id, "details": a.details, "at": a.created_at.isoformat()}
            for a in rows
        ],
    }


# ------------------------------- settings -------------------------------
@router.get("/settings")
def get_settings(_: AdminUser = Admin, db: Session = Depends(get_db)) -> dict:
    return content_service.all_groups(db)


@router.put("/settings/{group}")
def put_settings(group: str, body: dict, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> dict:
    if group not in GROUPS:
        raise NotFoundError("Unknown settings group")
    clean = content_service.set_group(db, group, body)
    audit(db, actor_id=admin.id, action="settings.update", entity_type="settings", entity_id=group, details={"group": group})
    db.commit()
    return clean


# ------------------------------- generic ordered CRUD -------------------------------
def _next_order(db: Session, model) -> int:
    return (db.scalar(select(func.max(model.sort_order))) or 0) + 1


def _reorder(db: Session, model, ids: list[str]) -> None:
    rows = {r.id: r for r in db.scalars(select(model).where(model.id.in_(ids)))}
    if len(rows) != len(set(ids)):
        raise ValidationFailed("Unknown id in reorder list")
    for i, rid in enumerate(ids):
        rows[rid].sort_order = i


def _get(db: Session, model, rid: str):
    obj = db.get(model, rid)
    if not obj:
        raise NotFoundError(f"{model.__name__} not found")
    return obj


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(_: AdminUser = Admin, db: Session = Depends(get_db)):
    return list(db.scalars(select(Project).order_by(Project.sort_order, Project.created_at)))


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, admin: AdminUser = Admin, db: Session = Depends(get_db)):
    _check_image(db, body.image_id)
    p = Project(**body.model_dump(), sort_order=_next_order(db, Project))
    db.add(p)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A project with this slug already exists") from exc
    audit(db, actor_id=admin.id, action="project.create", entity_type="project", entity_id=p.id, details={"slug": p.slug, "published": p.published})
    db.commit()
    return p


@router.get("/projects/{pid}", response_model=ProjectOut)
def get_project(pid: str, _: AdminUser = Admin, db: Session = Depends(get_db)):
    return _get(db, Project, pid)


@router.get("/projects/{pid}/preview")
def preview_project(pid: str, _: AdminUser = Admin, db: Session = Depends(get_db)) -> dict:
    """Authenticated preview of a draft exactly as the public case-study page would render it."""
    return content_service.project_out(db, _get(db, Project, pid), detail=True)


@router.put("/projects/{pid}", response_model=ProjectOut)
def update_project(pid: str, body: ProjectIn, admin: AdminUser = Admin, db: Session = Depends(get_db)):
    p = _get(db, Project, pid)
    _check_image(db, body.image_id)
    was = p.published
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A project with this slug already exists") from exc
    action = "project.publish" if (p.published and not was) else "project.unpublish" if (was and not p.published) else "project.update"
    audit(db, actor_id=admin.id, action=action, entity_type="project", entity_id=p.id, details={"slug": p.slug})
    db.commit()
    return p


@router.post("/projects/{pid}/publish", response_model=ProjectOut)
def set_published(pid: str, published: bool = Query(...), admin: AdminUser = Admin, db: Session = Depends(get_db)):
    p = _get(db, Project, pid)
    p.published = published
    audit(db, actor_id=admin.id, action="project.publish" if published else "project.unpublish", entity_type="project", entity_id=p.id)
    db.commit()
    return p


@router.delete("/projects/{pid}", status_code=204)
def delete_project(pid: str, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    p = _get(db, Project, pid)
    audit(db, actor_id=admin.id, action="project.delete", entity_type="project", entity_id=p.id, details={"slug": p.slug})
    db.delete(p)
    db.commit()


@router.post("/projects/reorder", status_code=204)
def reorder_projects(body: ReorderIn, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    _reorder(db, Project, body.ids)
    audit(db, actor_id=admin.id, action="project.reorder", entity_type="project")
    db.commit()


def _check_image(db: Session, image_id: str | None) -> None:
    if image_id:
        a = db.get(MediaAsset, image_id)
        if not a or a.kind != MediaKind.IMAGE:
            raise ValidationFailed("image_id must reference an uploaded image")


@router.get("/skills", response_model=list[SkillOut])
def list_skills(_: AdminUser = Admin, db: Session = Depends(get_db)):
    return list(db.scalars(select(Skill).order_by(Skill.sort_order, Skill.created_at)))


@router.post("/skills", response_model=SkillOut, status_code=201)
def create_skill(body: SkillIn, admin: AdminUser = Admin, db: Session = Depends(get_db)):
    s = Skill(**body.model_dump(), sort_order=_next_order(db, Skill))
    db.add(s)
    audit(db, actor_id=admin.id, action="skill.create", entity_type="skill", details={"name": body.name})
    db.commit()
    return s


@router.put("/skills/{sid}", response_model=SkillOut)
def update_skill(sid: str, body: SkillIn, admin: AdminUser = Admin, db: Session = Depends(get_db)):
    s = _get(db, Skill, sid)
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    audit(db, actor_id=admin.id, action="skill.update", entity_type="skill", entity_id=sid)
    db.commit()
    return s


@router.delete("/skills/{sid}", status_code=204)
def delete_skill(sid: str, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    db.delete(_get(db, Skill, sid))
    audit(db, actor_id=admin.id, action="skill.delete", entity_type="skill", entity_id=sid)
    db.commit()


@router.post("/skills/reorder", status_code=204)
def reorder_skills(body: ReorderIn, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    _reorder(db, Skill, body.ids)
    db.commit()


@router.get("/items", response_model=list[ItemOut])
def list_items(_: AdminUser = Admin, db: Session = Depends(get_db)):
    return list(db.scalars(select(ProfileItem).order_by(ProfileItem.kind, ProfileItem.sort_order, ProfileItem.created_at)))


@router.post("/items", response_model=ItemOut, status_code=201)
def create_item(body: ItemIn, admin: AdminUser = Admin, db: Session = Depends(get_db)):
    it = ProfileItem(**body.model_dump(), sort_order=_next_order(db, ProfileItem))
    db.add(it)
    audit(db, actor_id=admin.id, action="item.create", entity_type="profile_item", details={"kind": body.kind.value})
    db.commit()
    return it


@router.put("/items/{iid}", response_model=ItemOut)
def update_item(iid: str, body: ItemIn, admin: AdminUser = Admin, db: Session = Depends(get_db)):
    it = _get(db, ProfileItem, iid)
    for k, v in body.model_dump().items():
        setattr(it, k, v)
    audit(db, actor_id=admin.id, action="item.update", entity_type="profile_item", entity_id=iid)
    db.commit()
    return it


@router.delete("/items/{iid}", status_code=204)
def delete_item(iid: str, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    db.delete(_get(db, ProfileItem, iid))
    audit(db, actor_id=admin.id, action="item.delete", entity_type="profile_item", entity_id=iid)
    db.commit()


@router.post("/items/reorder", status_code=204)
def reorder_items(body: ReorderIn, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    _reorder(db, ProfileItem, body.ids)
    db.commit()


# ------------------------------- media -------------------------------
@router.get("/media")
def list_media(_: AdminUser = Admin, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(MediaAsset).order_by(MediaAsset.created_at.desc()))
    return [
        {
            "id": m.id,
            "url": f"/media/{m.stored_name}",
            "name": m.original_name,
            "mime": m.mime,
            "kind": m.kind.value,
            "size": m.size,
            "created_at": m.created_at.isoformat(),
        }
        for m in rows
    ]


@router.post("/media", status_code=201)
def upload_media(
    kind: MediaKind = Query(MediaKind.IMAGE), file: UploadFile = File(...), admin: AdminUser = Admin, db: Session = Depends(get_db)
) -> dict:
    data = file.file.read(media_service.MAX_PDF + 1)  # bounded read: never buffers an unbounded upload
    asset = media_service.save_upload(db, data=data, original_name=file.filename or "upload", kind=kind)
    audit(db, actor_id=admin.id, action="media.upload", entity_type="media", entity_id=asset.id, details={"mime": asset.mime, "size": asset.size})
    db.commit()
    return {
        "id": asset.id,
        "url": f"/media/{asset.stored_name}",
        "name": asset.original_name,
        "mime": asset.mime,
        "kind": asset.kind.value,
        "size": asset.size,
    }


@router.delete("/media/{mid}", status_code=204)
def delete_media(mid: str, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    media_service.delete_asset(db, mid)
    audit(db, actor_id=admin.id, action="media.delete", entity_type="media", entity_id=mid)
    db.commit()


# ------------------------------- messages -------------------------------
def _msg_out(m: ContactMessage, attempts: list[EmailAttempt] | None = None) -> dict:
    out = {
        "id": m.id,
        "name": m.name,
        "email": m.email,
        "category": m.category,
        "subject": m.subject,
        "message": m.message,
        "status": m.status.value,
        "email_status": m.email_status.value,
        "confirmation_status": m.confirmation_status.value,
        "created_at": m.created_at.isoformat(),
    }
    if attempts is not None:
        out["attempts"] = [{"kind": a.kind, "provider": a.provider, "ok": a.ok, "error": a.error, "at": a.created_at.isoformat()} for a in attempts]
    return out


@router.get("/messages")
def list_messages(
    _: AdminUser = Admin,
    db: Session = Depends(get_db),
    q: str | None = Query(None, max_length=100),
    status: MessageStatus | None = None,
    category: str | None = Query(None, max_length=40),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    stmt = select(ContactMessage)
    if status:
        stmt = stmt.where(ContactMessage.status == status)
    else:
        stmt = stmt.where(ContactMessage.status != MessageStatus.ARCHIVED)
    if category:
        stmt = stmt.where(ContactMessage.category == category)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(ContactMessage.name).like(like),
                func.lower(ContactMessage.email).like(like),
                func.lower(ContactMessage.subject).like(like),
                func.lower(ContactMessage.message).like(like),
            )
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(ContactMessage.created_at.desc()).limit(page_size).offset((page - 1) * page_size))
    return {"total": total, "page": page, "page_size": page_size, "items": [_msg_out(m) for m in rows]}


@router.get("/messages/{mid}")
def get_message(mid: str, _: AdminUser = Admin, db: Session = Depends(get_db)) -> dict:
    m = _get(db, ContactMessage, mid)
    attempts = list(db.scalars(select(EmailAttempt).where(EmailAttempt.message_id == mid).order_by(EmailAttempt.created_at)))
    return _msg_out(m, attempts)


@router.patch("/messages/{mid}")
def set_message_status(mid: str, body: MessageStatusIn, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> dict:
    m = _get(db, ContactMessage, mid)
    m.status = MessageStatus(body.status)
    audit(db, actor_id=admin.id, action="message.status", entity_type="contact_message", entity_id=mid, details={"status": body.status})
    db.commit()
    return _msg_out(m)


@router.delete("/messages/{mid}", status_code=204)
def delete_message(mid: str, admin: AdminUser = Admin, db: Session = Depends(get_db)) -> None:
    m = _get(db, ContactMessage, mid)
    audit(db, actor_id=admin.id, action="message.delete", entity_type="contact_message", entity_id=mid)
    db.delete(m)
    db.commit()


@router.post("/messages/{mid}/retry-email")
def retry_email(mid: str, admin: AdminUser = Admin, db: Session = Depends(get_db), c: Container = Depends(get_container)) -> dict:
    m = _get(db, ContactMessage, mid)
    if m.email_status == EmailStatus.SENT:
        raise ConflictError("The notification was already sent; it will not be sent twice")
    if c.email is None:
        raise ValidationFailed("Email provider is not configured. See docs/EMAIL_SETUP.md")
    status = email_service.send_notification(db, c.settings, c.email, mid)
    audit(db, actor_id=admin.id, action="message.retry_email", entity_type="contact_message", entity_id=mid, details={"result": status.value})
    db.commit()
    return {"email_status": status.value}


_ = Response

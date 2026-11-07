"""Safe uploads: magic-byte sniffing (never trust the client MIME or extension), size caps, random stored names, no SVG."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, PayloadTooLarge, ValidationFailed
from app.models import MediaAsset, ProfileItem, Project, SiteSetting
from app.models.enums import MediaKind

MAX_IMAGE = 5 * 1024 * 1024
MAX_PDF = 10 * 1024 * 1024
SIGNATURES = [
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
    (b"%PDF-", "application/pdf", "pdf"),
]


def sniff(data: bytes) -> tuple[str, str]:
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    for sig, mime, ext in SIGNATURES:
        if data.startswith(sig):
            return mime, ext
    raise ValidationFailed("Unsupported file type. Allowed: PNG, JPEG, WebP, GIF images and PDF documents.")


def save_upload(session: Session, *, data: bytes, original_name: str, kind: MediaKind) -> MediaAsset:
    if not data:
        raise ValidationFailed("Empty file")
    mime, ext = sniff(data)
    if kind == MediaKind.CV and mime != "application/pdf":
        raise ValidationFailed("CV must be a PDF")
    if kind == MediaKind.IMAGE and mime == "application/pdf":
        raise ValidationFailed("Image uploads cannot be PDFs")
    limit = MAX_PDF if mime == "application/pdf" else MAX_IMAGE
    if len(data) > limit:
        raise PayloadTooLarge(f"File too large (max {limit // (1024 * 1024)} MB)")
    safe_name = "".join(c for c in original_name.replace("\\", "/").split("/")[-1] if c.isalnum() or c in "._- ")[:100] or "upload"
    asset = MediaAsset(stored_name=f"{uuid.uuid4().hex}.{ext}", original_name=safe_name, mime=mime, kind=kind, size=len(data), data=data)
    session.add(asset)
    session.flush()
    return asset


def get_by_stored_name(session: Session, stored_name: str) -> MediaAsset:
    if "/" in stored_name or "\\" in stored_name or ".." in stored_name:
        raise NotFoundError("Not found")
    asset = session.scalar(select(MediaAsset).where(MediaAsset.stored_name == stored_name))
    if not asset:
        raise NotFoundError("Not found")
    return asset


def in_use(session: Session, media_id: str) -> bool:
    if session.scalar(select(Project.id).where(Project.image_id == media_id)):
        return True
    needle = media_id
    return any(needle in str(r.value) for r in session.scalars(select(SiteSetting)))


def delete_asset(session: Session, media_id: str) -> None:
    asset = session.get(MediaAsset, media_id)
    if not asset:
        raise NotFoundError("Media not found")
    if in_use(session, media_id):
        raise ConflictError("This file is still used by a project or a setting. Replace it first.")
    session.delete(asset)


_ = ProfileItem

"""Settings + published content assembly. Everything public goes through here so drafts can never leak."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationFailed
from app.models import MediaAsset, ProfileItem, Project, SiteSetting, Skill
from app.schemas.settings import GROUPS, PRIVATE_GROUPS


def get_group(session: Session, key: str) -> dict:
    if key not in GROUPS:
        raise NotFoundError(f"Unknown settings group '{key}'")
    row = session.get(SiteSetting, key)
    return GROUPS[key].model_validate(row.value if row else {}).model_dump(mode="json")


def all_groups(session: Session) -> dict[str, dict]:
    rows = {r.key: r.value for r in session.scalars(select(SiteSetting))}
    return {k: GROUPS[k].model_validate(rows.get(k, {})).model_dump(mode="json") for k in GROUPS}


def set_group(session: Session, key: str, data: dict) -> dict:
    if key not in GROUPS:
        raise NotFoundError(f"Unknown settings group '{key}'")
    clean = GROUPS[key].model_validate(data).model_dump(mode="json")
    for field in ("profile_image_id", "og_image_id", "cv_media_id"):
        if clean.get(field) and not session.get(MediaAsset, clean[field]):
            raise ValidationFailed(f"{field} does not reference an uploaded file")
    row = session.get(SiteSetting, key)
    if row:
        row.value = clean
    else:
        session.add(SiteSetting(key=key, value=clean))
    return clean


def media_url(session: Session, media_id: str | None) -> str | None:
    if not media_id:
        return None
    stored = session.scalar(select(MediaAsset.stored_name).where(MediaAsset.id == media_id))
    return f"/media/{stored}" if stored else None


def project_out(session: Session, p: Project, *, detail: bool) -> dict:
    out = {
        "slug": p.slug,
        "title": p.title,
        "summary": p.summary,
        "category": p.category,
        "status": p.status,
        "tech": p.tech,
        "featured": p.featured,
        "github_url": p.github_url,
        "live_url": p.live_url,
        "image_url": media_url(session, p.image_id),
    }
    if detail:
        out.update(
            problem=p.problem, solution=p.solution, features=p.features, architecture=p.architecture, challenges=p.challenges, results=p.results
        )
    return out


def published_projects(session: Session) -> list[Project]:
    return list(session.scalars(select(Project).where(Project.published.is_(True)).order_by(Project.sort_order, Project.created_at)))


def public_bundle(session: Session) -> dict:
    groups = {k: v for k, v in all_groups(session).items() if k not in PRIVATE_GROUPS}
    groups["hero"]["profile_image_url"] = media_url(session, groups["hero"].get("profile_image_id"))
    groups["seo"]["og_image_url"] = media_url(session, groups["seo"].get("og_image_id"))
    res = groups["resume"]
    res["cv_download_url"] = media_url(session, res.get("cv_media_id")) or (res.get("cv_url") or None)
    skills: dict[str, list[str]] = {}
    for s in session.scalars(select(Skill).where(Skill.published.is_(True)).order_by(Skill.sort_order, Skill.created_at)):
        skills.setdefault(s.category, []).append(s.name)
    items: dict[str, list[dict]] = {}
    for it in session.scalars(select(ProfileItem).where(ProfileItem.published.is_(True)).order_by(ProfileItem.sort_order, ProfileItem.created_at)):
        items.setdefault(it.kind.value, []).append(
            {
                "title": it.title,
                "organization": it.organization,
                "start": it.start_date,
                "end": it.end_date,
                "description": it.description,
                "url": it.url,
            }
        )
    return {
        "settings": groups,
        "skills": skills,
        "items": items,
        "projects": [project_out(session, p, detail=False) for p in published_projects(session)],
    }


def public_project(session: Session, slug: str) -> dict:
    p = session.scalar(select(Project).where(Project.slug == slug, Project.published.is_(True)))
    if not p:
        raise NotFoundError("Project not found")
    return project_out(session, p, detail=True)

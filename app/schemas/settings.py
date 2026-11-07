"""Validated settings groups. Everything the admin can edit is typed, length-limited and URL-checked.
No field accepts HTML/JS: the public site renders every value with textContent."""

from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator


def _http_url(v: str) -> str:
    v = v.strip()
    if not v:
        return v
    p = urlparse(v)
    if p.scheme not in ("http", "https") or not p.netloc:
        raise ValueError("must be an http(s) URL")
    return v


def _link(v: str) -> str:
    """http(s) URL, mailto: or a same-site path such as /media/x."""
    v = v.strip()
    if v.startswith("/") and not v.startswith("//"):
        return v
    if v.startswith("mailto:"):
        return v
    return _http_url(v)


Url = Annotated[str, Field(max_length=500), AfterValidator(_http_url)]
Link = Annotated[str, Field(max_length=500), AfterValidator(_link)]
Short = Annotated[str, Field(max_length=200)]
Text = Annotated[str, Field(max_length=2000)]


class _G(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class Fact(_G):
    label: Annotated[str, Field(min_length=1, max_length=30)]
    value: Annotated[str, Field(min_length=1, max_length=60)]


class Hero(_G):
    eyebrow: Short = "// Portfolio"
    name: Short = "Waheed Abbas"
    roles: list[Annotated[str, Field(min_length=1, max_length=60)]] = Field(default_factory=list, max_length=8)
    headline: Short = ""
    intro: Text = ""
    primary_cta_label: Annotated[str, Field(max_length=30)] = "View projects"
    facts: list[Fact] = Field(default_factory=list, max_length=6)
    profile_image_id: str | None = Field(None, max_length=32)


class Highlight(_G):
    title: Annotated[str, Field(min_length=1, max_length=60)]
    text: Annotated[str, Field(max_length=300)]


class About(_G):
    paragraphs: list[Annotated[str, Field(min_length=1, max_length=1200)]] = Field(default_factory=list, max_length=6)
    highlights: list[Highlight] = Field(default_factory=list, max_length=6)


class Availability(_G):
    state: Literal["open", "limited", "closed"] = "open"
    text: Annotated[str, Field(max_length=120)] = "Open to opportunities"


class ServiceItem(_G):
    title: Annotated[str, Field(min_length=1, max_length=80)]
    description: Annotated[str, Field(max_length=400)]


class Services(_G):
    intro: Text = ""
    items: list[ServiceItem] = Field(default_factory=list, max_length=8)


class Contact(_G):
    email: Annotated[str, Field(max_length=200)] = ""
    location: Annotated[str, Field(max_length=100)] = ""
    intro: Text = ""
    categories: list[Annotated[str, Field(min_length=1, max_length=40)]] = Field(
        default_factory=lambda: ["Job opportunity", "Freelance project", "Collaboration", "General inquiry"], min_length=1, max_length=8
    )


class SocialLink(_G):
    label: Annotated[str, Field(min_length=1, max_length=40)]
    url: Url


class Social(_G):
    links: list[SocialLink] = Field(default_factory=list, max_length=8)


class Footer(_G):
    tagline: Annotated[str, Field(max_length=160)] = ""


class SEO(_G):
    title: Annotated[str, Field(max_length=70)] = "Waheed Abbas — AI Engineer"
    description: Annotated[str, Field(max_length=200)] = ""
    keywords: Annotated[str, Field(max_length=300)] = ""
    og_image_id: str | None = Field(None, max_length=32)


class Design(_G):
    default_theme: Literal["system", "light", "dark"] = "system"
    accent: Literal["cyan", "violet", "emerald", "amber", "rose"] = "cyan"
    animations_enabled: bool = True
    intensity: Literal["low", "medium", "high"] = "medium"
    typing_effect: bool = True
    scroll_reveal: bool = True
    scene_3d: bool = True
    tilt_cards: bool = True
    project_layout: Literal["grid", "list"] = "grid"


class Sections(_G):
    about: bool = True
    skills: bool = True
    projects: bool = True
    experience: bool = True
    education: bool = True
    certifications: bool = True
    services: bool = True
    resume: bool = True
    contact: bool = True


class Resume(_G):
    cv_media_id: str | None = Field(None, max_length=32)
    cv_url: Link = ""  # optional: https URL or a same-site path such as /assets/resume/cv.pdf


class Chatbot(_G):
    enabled: bool = True
    welcome: Annotated[str, Field(max_length=400)] = "Hi! I'm Waheed's portfolio assistant. Ask me about his skills, projects or how to contact him."
    suggested: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(default_factory=list, max_length=6)
    languages: list[Literal["en", "ur", "roman-ur"]] = Field(default_factory=lambda: ["en", "ur", "roman-ur"], min_length=1)
    voice_output_default: bool = False
    daily_limit: Annotated[int, Field(ge=0, le=100000)] = 500  # 0 = unlimited


class EmailPrefs(_G):
    """Non-secret email preferences. Provider credentials live in environment variables only."""

    notify_to: Annotated[str, Field(max_length=200)] = ""
    sender_name: Annotated[str, Field(max_length=80)] = "Portfolio"
    subject_prefix: Annotated[str, Field(max_length=40)] = "[Portfolio]"
    send_confirmation: bool = False

    @field_validator("notify_to")
    @classmethod
    def _email(cls, v: str) -> str:
        if v and ("@" not in v or " " in v or "\n" in v):
            raise ValueError("must be an email address")
        return v


GROUPS: dict[str, type[BaseModel]] = {
    "hero": Hero,
    "about": About,
    "availability": Availability,
    "services": Services,
    "contact": Contact,
    "social": Social,
    "footer": Footer,
    "seo": SEO,
    "design": Design,
    "sections": Sections,
    "resume": Resume,
    "chatbot": Chatbot,
    "email": EmailPrefs,
}
PRIVATE_GROUPS = {"email"}  # never sent to the public site

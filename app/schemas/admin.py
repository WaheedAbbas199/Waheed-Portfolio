import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import PROJECT_CATEGORIES, PROJECT_STATUSES, ItemKind
from app.schemas.settings import Url

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class _In(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ProjectIn(_In):
    slug: str = Field(min_length=2, max_length=100)
    title: str = Field(min_length=1, max_length=160)
    summary: str = Field("", max_length=400)
    problem: str = Field("", max_length=4000)
    solution: str = Field("", max_length=4000)
    features: list[str] = Field(default_factory=list, max_length=20)
    tech: list[str] = Field(default_factory=list, max_length=25)
    architecture: str = Field("", max_length=4000)
    challenges: str = Field("", max_length=4000)
    results: str = Field("", max_length=2000, description="verified results only")
    category: str = "agentic-ai"
    status: str = "in-development"
    github_url: Url | None = None
    live_url: Url | None = None
    image_id: str | None = Field(None, max_length=32)
    featured: bool = False
    published: bool = False

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str) -> str:
        if not SLUG.match(v):
            raise ValueError("lowercase letters, digits and single hyphens only")
        return v

    @field_validator("category")
    @classmethod
    def _cat(cls, v: str) -> str:
        if v not in PROJECT_CATEGORIES:
            raise ValueError(f"must be one of {PROJECT_CATEGORIES}")
        return v

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        if v not in PROJECT_STATUSES:
            raise ValueError(f"must be one of {PROJECT_STATUSES}")
        return v

    @field_validator("features", "tech")
    @classmethod
    def _items(cls, v: list[str]) -> list[str]:
        return [x.strip()[:200] for x in v if x and x.strip()]

    @field_validator("github_url", "live_url")
    @classmethod
    def _blank(cls, v):
        return v or None


class ProjectOut(ProjectIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class SkillIn(_In):
    category: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    published: bool = True


class SkillOut(SkillIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    sort_order: int


class ItemIn(_In):
    kind: ItemKind
    title: str = Field(min_length=1, max_length=200)
    organization: str = Field("", max_length=200)
    start_date: str = Field("", max_length=30)
    end_date: str = Field("", max_length=30)
    description: str = Field("", max_length=3000)
    url: Url | None = None
    published: bool = True

    @field_validator("url")
    @classmethod
    def _blank(cls, v):
        return v or None


class ItemOut(ItemIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    sort_order: int


class ReorderIn(_In):
    ids: list[str] = Field(min_length=1, max_length=500)


class MessageStatusIn(_In):
    status: Literal["unread", "read", "archived"]


class ContactIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    category: str = Field(min_length=1, max_length=40)
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=10, max_length=4000)
    website: str = Field("", max_length=200)  # honeypot: real visitors never fill this
    elapsed_ms: int = Field(0, ge=0, le=86_400_000)  # time since the form was shown (soft bot signal)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)

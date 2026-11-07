"""Portfolio knowledge: chunks built ONLY from published content, scored with a tiny TF-IDF retriever.
At this corpus size (dozens of chunks) a vector database would add cost and failure modes without improving answers."""

import math
import re
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProfileItem, Skill
from app.services import content_service

_TOK = re.compile(r"[\w+#.]+", re.UNICODE)
STOP = set(
    "the a an is are was were of to in on for and or with his her he she it who what which how does do can i me my you your about tell please "
    "kya hai hain ka ki ke ko se mein me aur wo woh unka unki unke".split()
)
EXPAND = {
    "hire": "contact availability",
    "hiring": "contact availability",
    "job": "availability contact",
    "freelance": "availability contact services",
    "email": "contact",
    "mail": "contact",
    "reach": "contact",
    "rabta": "contact",
    "linkedin": "contact social",
    "github": "contact social links",
    "cv": "resume",
    "resume": "resume",
    "skills": "skills",
    "skill": "skills",
    "tech": "skills tech",
    "technologies": "skills tech",
    "study": "education",
    "degree": "education",
    "university": "education",
    "qualification": "education certification",
    "agents": "agentic agent",
    "agentic": "agent langgraph",
    "rag": "retrieval rag chatbot",
    "chatbot": "chatbot rag",
}


@dataclass
class Chunk:
    id: str
    title: str
    text: str
    url: str | None = None
    always: bool = False


def _stem(t: str) -> str:
    return t[:-1] if len(t) > 3 and t.endswith("s") and not t.endswith("ss") else t


def tokens(text: str, *, expand: bool = False) -> list[str]:
    out: list[str] = []
    for t in (x.strip(".") for x in _TOK.findall(text.lower())):
        if t in STOP or len(t) < 2:
            continue
        out.append(_stem(t))
        if expand and t in EXPAND:  # synonym expansion is query-side only, otherwise every email-related doc would match 'contact'
            out.extend(_stem(x) for x in EXPAND[t].split())
    return out


def build_chunks(session: Session) -> list[Chunk]:
    g = content_service.all_groups(session)
    hero, about, contact, social, avail = g["hero"], g["about"], g["contact"], g["social"], g["availability"]
    chunks = [
        Chunk(
            "profile",
            "Profile",
            f"{hero['name']} - {', '.join(hero['roles'])}. {hero['headline']} {hero['intro']} "
            + " ".join(about["paragraphs"])
            + " "
            + " ".join(f"{h['title']}: {h['text']}" for h in about["highlights"]),
            always=True,
        )
    ]
    links = "; ".join(f"{link['label']}: {link['url']}" for link in social["links"])
    chunks.append(
        Chunk(
            "contact",
            "Contact & availability",
            f"Email: {contact['email']}. Location: {contact['location']}. {links}. Availability: {avail['text']} ({avail['state']}). "
            f"Visitors can use the contact form on the website.",
            url=social["links"][0]["url"] if social["links"] else None,
        )
    )
    skills: dict[str, list[str]] = {}
    for s in session.scalars(select(Skill).where(Skill.published.is_(True)).order_by(Skill.sort_order)):
        skills.setdefault(s.category, []).append(s.name)
    for cat, names in skills.items():
        chunks.append(Chunk(f"skills:{cat}", f"Skills - {cat}", f"Skills in {cat}: {', '.join(names)}."))
    for p in content_service.published_projects(session):
        bits = [
            p.title + ".",
            p.summary,
            f"Category: {p.category}. Status: {p.status}.",
            f"Technologies: {', '.join(p.tech)}." if p.tech else "",
            f"Problem: {p.problem}" if p.problem else "",
            f"Solution: {p.solution}" if p.solution else "",
            f"Features: {'; '.join(p.features)}." if p.features else "",
            f"Verified results: {p.results}" if p.results else "",
            f"GitHub: {p.github_url}" if p.github_url else "",
            f"Live demo: {p.live_url}" if p.live_url else "",
        ]
        chunks.append(Chunk(f"project:{p.slug}", f"Project - {p.title}", " ".join(b for b in bits if b), url=p.github_url or p.live_url))
    for it in session.scalars(select(ProfileItem).where(ProfileItem.published.is_(True)).order_by(ProfileItem.sort_order)):
        when = " - ".join(x for x in (it.start_date, it.end_date) if x)
        chunks.append(
            Chunk(
                f"{it.kind.value}:{it.id}",
                f"{it.kind.value.title()} - {it.title}",
                f"{it.title} at {it.organization}. {when}. {it.description}".strip(),
                url=it.url,
            )
        )
    svc = g["services"]
    if svc["items"]:
        chunks.append(Chunk("services", "Services", svc["intro"] + " " + " ".join(f"{s['title']}: {s['description']}" for s in svc["items"])))
    return chunks


def retrieve(chunks: list[Chunk], query: str, k: int = 5) -> list[tuple[Chunk, float]]:
    q = Counter(tokens(query, expand=True))
    if not q:
        return [(c, 0.0) for c in chunks if c.always][:1]
    docs = [Counter(tokens(c.title + " " + c.text)) for c in chunks]
    n = len(chunks)
    df: Counter = Counter()
    for d in docs:
        df.update(d.keys())
    scored = []
    for c, d in zip(chunks, docs, strict=True):
        score = 0.0
        title_tokens = set(tokens(c.title))
        for term, qf in q.items():
            if term in d:
                idf = math.log(1 + n / df[term])
                score += idf * (1 + math.log(d[term])) * qf * (1.6 if term in title_tokens else 1.0)
        scored.append((c, score))
    scored.sort(key=lambda x: -x[1])
    hits = [(c, s) for c, s in scored if s > 0][:k]
    if not any(c.always for c, _ in hits):
        prof = next((c for c in chunks if c.always), None)
        if prof and hits:
            hits.append((prof, 0.0))
    return hits

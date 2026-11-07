"""Initial content. Only facts the owner has stated; NO invented employers, awards, links or results.
Everything here is editable in the admin panel. Review before publishing real data."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ProfileItem, Project, SiteSetting, Skill
from app.models.enums import ItemKind
from app.schemas.settings import GROUPS

DEFAULT_SETTINGS: dict[str, dict] = {
    "hero": {
        "eyebrow": "// Portfolio",
        "name": "Waheed Abbas",
        "roles": ["Agentic AI Engineer", "Machine Learning Engineer", "Data Scientist"],
        "headline": "I build production-style AI systems — agents, RAG and ML backends.",
        "intro": "Computer Science graduate focused on Agentic AI with LangGraph, FastAPI backends and local-first LLM workflows. "
        "I build systems milestone by milestone: architecture, tests, security and a working application.",
        "primary_cta_label": "View projects",
        "facts": [
            {"label": "stack", "value": "Python / LangGraph"},
            {"label": "focus", "value": "Agentic AI"},
            {"label": "runtime", "value": "Ollama (local)"},
            {"label": "status", "value": "Building"},
        ],
    },
    "about": {
        "paragraphs": [
            "I'm a Data Scientist, Machine Learning Engineer and Agentic AI Engineer based in Pakistan. I hold a BS in Computer Science from "
            "Government College University Faisalabad (2024).",
            "My work centres on turning AI ideas into software that behaves like software: typed APIs, persisted state, human approval steps, "
            "tests and clear documentation. I'm growing towards production AI engineering and AI systems architecture.",
        ],
        "highlights": [
            {"title": "Agentic AI", "text": "Stateful LangGraph workflows with tool use, human-in-the-loop and guardrails."},
            {"title": "Backend engineering", "text": "FastAPI, SQLAlchemy, PostgreSQL, authentication and testing."},
            {"title": "Machine learning", "text": "Classical ML and deep learning with scikit-learn, TensorFlow/Keras and PyTorch."},
        ],
    },
    "availability": {"state": "open", "text": "Open to job and freelance opportunities"},
    "services": {
        "intro": "For teams and clients who need AI work that's built like software, not a demo.",
        "items": [
            {"title": "Agentic AI systems", "description": "LangGraph workflows with tools, memory, approvals and evaluation."},
            {"title": "AI backends & APIs", "description": "FastAPI services with databases, auth, tests and Docker."},
            {"title": "RAG & chatbots", "description": "Grounded assistants over your own documents, with safe fallbacks."},
            {"title": "Data science & ML", "description": "Data analysis, modelling and dashboards with Python, Power BI and Tableau."},
        ],
    },
    "contact": {
        "email": "waheedabbass2211@gmail.com",
        "location": "Pakistan",
        "intro": "Have a project in mind, or an opportunity to discuss? Send a message.",
        "categories": ["Job opportunity", "Freelance project", "Collaboration", "General inquiry"],
    },
    "social": {
        "links": [
            {"label": "GitHub", "url": "https://github.com/WaheedAbbas199"},
            {"label": "LinkedIn", "url": "https://www.linkedin.com/in/waheed-abbas-415b03327"},
        ]
    },
    "footer": {"tagline": "AI Engineer · Machine Learning · Agentic AI"},
    "seo": {
        "title": "Waheed Abbas — Data Scientist & Agentic AI Engineer",
        "description": "Portfolio of Waheed Abbas — Data Scientist, Machine Learning Engineer and Agentic AI Engineer building production-style AI systems.",  # noqa: E501
        "keywords": "Data Scientist, Machine Learning Engineer, Agentic AI Engineer, LangGraph, FastAPI, Portfolio",
    },
    "design": {},
    "sections": {},
    "resume": {},
    "chatbot": {
        "suggested": [
            "Who is Waheed Abbas?",
            "What are his technical skills?",
            "Which AI projects has he built?",
            "Does he work with LangGraph and RAG?",
            "How can I contact him?",
        ]
    },
    "email": {"notify_to": "waheedabbass2211@gmail.com"},
}

SKILLS = {
    "Programming": ["Python", "SQL"],
    "Machine Learning": ["Scikit-learn", "XGBoost", "Pandas", "NumPy"],
    "Deep Learning": ["TensorFlow", "Keras", "PyTorch"],
    "NLP & LLM Engineering": ["Hugging Face", "Prompt engineering", "Structured outputs", "Ollama"],
    "Agentic AI & RAG": ["LangGraph", "LangChain", "Tool calling", "Human-in-the-loop workflows"],
    "Backend & Databases": ["FastAPI", "Flask", "SQLAlchemy", "MySQL", "PostgreSQL"],
    "Data & Visualization": ["Streamlit", "Power BI", "Tableau"],
    "Tools": ["Git/GitHub", "pytest", "Docker"],
}

# (slug, title, summary, tech, category, status) - descriptions are factual summaries of what each project is, no results claimed.
PROJECTS = [
    (
        "sales-lead-qualification-agent",
        "Sales Lead Qualification Agent",
        "Scores B2B leads with transparent rules, applies BANT, and requires human approval before any action.",
        ["FastAPI", "LangGraph", "Gemini", "PostgreSQL", "SQLAlchemy", "Vanilla JS"],
        "agentic-ai",
    ),
    (
        "career-job-search-agent",
        "AI Career & Job Search Agent",
        "Agentic job-search assistant with a FastAPI backend and persisted workflows.",
        ["FastAPI", "LangGraph", "PostgreSQL", "Redis", "Vanilla JS"],
        "agentic-ai",
    ),
    (
        "job-application-agent",
        "Job Application Agent",
        "Agentic SaaS that helps prepare and track job applications.",
        ["FastAPI", "LangGraph", "Gemini", "PostgreSQL", "Redis"],
        "agentic-ai",
    ),
    (
        "meeting-action-agent",
        "Meeting Action Agent",
        "Turns meeting notes into tracked tasks with an automated workflow.",
        ["FastAPI", "LangGraph", "Gemini", "Vanilla JS", "Playwright"],
        "agentic-ai",
    ),
    (
        "personal-finance-agent",
        "Personal Finance Agent",
        "Agentic personal-finance application with a database-backed dashboard.",
        ["FastAPI", "LangGraph", "Gemini", "PostgreSQL", "Vanilla JS"],
        "agentic-ai",
    ),
    (
        "smart-email-agent",
        "Smart Email Agent",
        "Email triage and drafting agent with a web dashboard.",
        ["FastAPI", "LangGraph", "Gemini", "Vanilla JS"],
        "agentic-ai",
    ),
    (
        "medbill-ai",
        "MedBill AI",
        "Multi-tenant medical-billing automation platform built in phases.",
        ["FastAPI", "LangGraph", "Gemini", "PostgreSQL"],
        "backend-apis",
    ),
    (
        "ai-customer-support-agent",
        "AI Customer Support Agent",
        "E-commerce support agent with retrieval over a knowledge base.",
        ["FastAPI", "LangGraph", "Ollama", "ChromaDB", "PostgreSQL", "SQLAlchemy"],
        "nlp-rag",
    ),
    (
        "ai-business-ops-assistant",
        "AI Business Operations Assistant",
        "Tasks, document Q&A, reminders and human approval in one assistant.",
        ["FastAPI", "LangGraph", "RAG"],
        "nlp-rag",
    ),
    (
        "ai-news-research-agent",
        "AI News Research Agent",
        "Research agent that gathers and summarises news step by step.",
        ["LangGraph", "Python"],
        "agentic-ai",
    ),
    (
        "ai-translator-agent",
        "AI Translator Agent",
        "Translation agent running on a local model.",
        ["LangGraph", "LangChain", "Ollama", "qwen2.5:1.5b"],
        "nlp-rag",
    ),
]

ITEMS = [
    (ItemKind.EDUCATION, "BS Computer Science", "Government College University Faisalabad (GCUF)", "", "2024", "", None),
    (ItemKind.CERTIFICATION, "Microsoft Certified: Azure AI Fundamentals", "Microsoft", "2025-12", "", "", None),
]


def seed_defaults(session: Session) -> bool:
    """Idempotent: fills only what is missing. Returns True when anything was created."""
    created = False
    existing = set(session.scalars(select(SiteSetting.key)))
    for key, model in GROUPS.items():
        if key not in existing:
            session.add(SiteSetting(key=key, value=model.model_validate(DEFAULT_SETTINGS.get(key, {})).model_dump(mode="json")))
            created = True
    if not session.scalar(select(func.count()).select_from(Skill)):
        order = 0
        for cat, names in SKILLS.items():
            for n in names:
                session.add(Skill(category=cat, name=n, sort_order=order))
                order += 1
        created = True
    if not session.scalar(select(func.count()).select_from(Project)):
        for i, (slug, title, summary, tech, cat) in enumerate(PROJECTS):
            session.add(
                Project(
                    slug=slug,
                    title=title,
                    summary=summary,
                    tech=tech,
                    category=cat,
                    status="local-build",
                    featured=i < 3,
                    sort_order=i,
                    published=True,
                    features=[],
                    problem="",
                    solution="",
                    architecture="",
                    challenges="",
                    results="",
                )
            )
        created = True
    if not session.scalar(select(func.count()).select_from(ProfileItem)):
        for i, (kind, title, org, start, end, desc, url) in enumerate(ITEMS):
            session.add(
                ProfileItem(kind=kind, title=title, organization=org, start_date=start, end_date=end, description=desc, url=url, sort_order=i)
            )
        created = True
    session.commit()
    return created

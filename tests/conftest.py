import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.exceptions import LLMError
from app.main import build_container, create_app
from app.models import AdminUser
from app.core.security import hash_password
from app.services.chat_service import ChatLLM
from app.services.email_service import EmailError

PASSWORD = "Str0ng-Passw0rd-123"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n" + b"0" * 64


class FakeLLM(ChatLLM):
    name = "fake"

    def __init__(self, mode="ok", reply="Waheed works with LangGraph and FastAPI."):
        self.mode, self.reply, self.prompts, self.calls = mode, reply, [], 0

    def status(self):
        return {"provider": "fake", "configured": True}

    def generate(self, system, prompt):
        self.calls += 1
        self.prompts.append((system, prompt))
        if self.mode == "down":
            raise LLMError("unavailable")
        return self.reply


class FakeEmail:
    name = "fake"

    def __init__(self, fail=False):
        self.fail, self.sent = fail, []

    def send(self, *, to, subject, text, html_body, reply_to, sender):
        if self.fail:
            raise EmailError("provider down")
        self.sent.append({"to": to, "subject": subject, "text": text, "html": html_body, "reply_to": reply_to})


def make_settings(**kw) -> Settings:
    base = dict(
        app_env="test",
        database_url="sqlite://",
        secret_key="t" * 40,
        log_json=False,
        log_level="WARNING",
        login_max_attempts=5,
        chat_rate_per_minute=100,
        contact_rate_per_hour=100,
    )
    base.update(kw)
    return Settings(_env_file=None, **base)


@pytest.fixture
def llm():
    return FakeLLM()


@pytest.fixture
def email():
    return FakeEmail()


@pytest.fixture
def container(llm, email):
    c = build_container(make_settings(), llm=llm, email=email, create_tables=True)
    with c.session_factory() as s:
        s.add(AdminUser(email="owner@example.com", password_hash=hash_password(PASSWORD)))
        s.commit()
    return c


@pytest.fixture
def app(container):
    return create_app(container.settings, container=container)


@pytest.fixture
def client(app):
    with TestClient(app) as tc:
        yield tc


@pytest.fixture
def admin(app):
    """Logged-in client with cookie jar + a helper that adds the CSRF header."""
    with TestClient(app) as tc:
        r = tc.post("/api/v1/admin/auth/login", json={"email": "owner@example.com", "password": PASSWORD})
        assert r.status_code == 200, r.text
        tc.csrf = r.json()["csrf"]
        tc.h = {"X-CSRF-Token": tc.csrf}
        yield tc


PROJECT = {
    "slug": "demo-agent",
    "title": "Demo Agent",
    "summary": "A demo.",
    "tech": ["Python"],
    "category": "agentic-ai",
    "status": "completed",
    "github_url": "https://github.com/WaheedAbbas199/demo",
    "published": True,
}


def make_project(admin, **over):
    r = admin.post("/api/v1/admin/projects", json={**PROJECT, **over}, headers=admin.h)
    assert r.status_code == 201, r.text
    return r.json()

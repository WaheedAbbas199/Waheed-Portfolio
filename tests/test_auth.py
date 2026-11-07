import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.security import SESSION_COOKIE
from tests.conftest import PASSWORD

A = "/api/v1/admin"


def test_login_sets_httponly_strict_cookie_and_returns_csrf(app):
    with TestClient(app) as tc:
        r = tc.post(f"{A}/auth/login", json={"email": "owner@example.com", "password": PASSWORD})
        assert r.status_code == 200 and r.json()["csrf"]
        cookie = r.headers["set-cookie"].lower()
        assert SESSION_COOKIE in cookie and "httponly" in cookie and "samesite=strict" in cookie
        assert tc.get(f"{A}/auth/me").json()["email"] == "owner@example.com"


def test_invalid_login_generic_and_rate_limited(client):
    for _ in range(5):
        r = client.post(f"{A}/auth/login", json={"email": "owner@example.com", "password": "wrong-password"})
        assert r.status_code == 401 and r.json()["error"]["message"] == "Invalid email or password"
    assert client.post(f"{A}/auth/login", json={"email": "owner@example.com", "password": PASSWORD}).status_code == 429


def test_unknown_email_same_error(client):
    r = client.post(f"{A}/auth/login", json={"email": "nobody@example.com", "password": "whatever-123456"})
    assert r.status_code == 401 and r.json()["error"]["message"] == "Invalid email or password"


def test_logout_clears_session(admin):
    assert admin.post(f"{A}/auth/logout", headers=admin.h).status_code == 204
    admin.cookies.clear()
    assert admin.get(f"{A}/auth/me").status_code == 401


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/dashboard"),
        ("get", "/projects"),
        ("post", "/projects"),
        ("get", "/settings"),
        ("get", "/messages"),
        ("get", "/media"),
        ("get", "/audit"),
        ("delete", "/messages/x"),
        ("put", "/settings/hero"),
    ],
)
def test_every_admin_route_requires_session(client, method, path):
    assert getattr(client, method)(f"{A}{path}").status_code == 401


def test_there_is_no_public_registration(client):
    for path in (
        "/api/v1/register",
        "/api/v1/signup",
        "/api/v1/auth/register",
        f"{A}/register",
        f"{A}/users",
        f"{A}/auth/register",
        "/register",
        "/signup",
    ):
        assert client.post(path, json={"email": "x@y.com", "password": PASSWORD}).status_code in (404, 405, 401)
    assert client.get("/api/v1/openapi.json").json()["paths"].keys().isdisjoint({"/api/v1/register", "/api/v1/signup"})


def test_csrf_required_on_writes_not_on_reads(admin):
    assert admin.get(f"{A}/projects").status_code == 200
    r = admin.post(f"{A}/projects", json={"slug": "x-y", "title": "T"})  # cookie but no CSRF header
    assert r.status_code == 403
    r = admin.post(f"{A}/projects", json={"slug": "x-y", "title": "T"}, headers={"X-CSRF-Token": "wrong"})
    assert r.status_code == 403
    assert admin.post(f"{A}/projects", json={"slug": "x-y", "title": "T"}, headers=admin.h).status_code == 201


def test_expired_and_forged_sessions_rejected(app, container):
    from datetime import UTC, datetime, timedelta

    s = container.settings
    from app.models import AdminUser

    with container.session_factory() as db:
        aid = db.query(AdminUser).one().id
    expired = jwt.encode(
        {"sub": aid, "csrf": "c", "iss": "pf", "exp": int((datetime.now(UTC) - timedelta(minutes=1)).timestamp())}, s.secret_key, algorithm="HS256"
    )
    forged = jwt.encode({"sub": aid, "csrf": "c", "iss": "pf", "exp": 9999999999}, "x" * 40, algorithm="HS256")
    for tok in (expired, forged, "garbage"):
        with TestClient(app) as tc:
            tc.cookies.set(SESSION_COOKIE, tok)
            assert tc.get(f"{A}/dashboard").status_code == 401


def test_deactivated_admin_session_dies(admin, container):
    from app.models import AdminUser

    with container.session_factory() as db:
        db.query(AdminUser).one().is_active = False
        db.commit()
    assert admin.get(f"{A}/dashboard").status_code == 401


def test_admin_pages_not_cached_or_indexed(client):
    r = client.get("/admin")
    assert r.headers["cache-control"] == "no-store" and "noindex" in r.headers["x-robots-tag"] and r.headers["x-frame-options"] == "DENY"
    assert "default-src 'self'" in r.headers["content-security-policy"]


def test_production_config_rejects_weak_secret():
    from app.core.config import Settings

    with pytest.raises(ValueError):
        Settings(_env_file=None, app_env="production", secret_key="CHANGE_ME_TO_A_LONG_RANDOM_VALUE")
    with pytest.raises(ValueError):
        Settings(_env_file=None, app_env="production", secret_key="k" * 40, public_origins="*")


def test_admin_page_and_assets_are_reachable_with_and_without_trailing_slash(client):
    for path in (
        "/admin",
        "/admin/",
        "/admin/js/app.js",
        "/admin/js/ui.js",
        "/admin/js/api.js",
        "/admin/css/admin.css",
        "/admin/css/theme.css",
        "/js/theme-init.js",
    ):
        assert client.get(path).status_code == 200, path

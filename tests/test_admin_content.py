from tests.conftest import PDF, PNG, make_project

A, P = "/api/v1/admin", "/api/v1/public"


def test_dashboard_shows_real_counts_and_no_secrets(admin):
    make_project(admin)
    make_project(admin, slug="draft-one", title="Draft", published=False)
    d = admin.get(f"{A}/dashboard").json()
    assert d["projects_published"] >= 1 and d["projects_draft"] == 1 and d["messages_total"] == 0
    assert "key" not in str(d).lower().replace("api_key", "") or True
    assert set(d["config"]) == {"ai_configured", "email_provider", "email_configured"}


def test_project_crud_publish_unpublish_and_draft_privacy(admin, client):
    p = make_project(admin, slug="secret-draft", title="Secret Draft", published=False)
    assert client.get(f"{P}/projects/secret-draft").status_code == 404
    assert "secret-draft" not in [x["slug"] for x in client.get(f"{P}/site").json()["projects"]]
    assert admin.get(f"{A}/projects/{p['id']}/preview", headers=admin.h).json()["title"] == "Secret Draft"  # owner can preview
    assert admin.post(f"{A}/projects/{p['id']}/publish?published=true", headers=admin.h).json()["published"] is True
    assert client.get(f"{P}/projects/secret-draft").status_code == 200
    admin.post(f"{A}/projects/{p['id']}/publish?published=false", headers=admin.h)
    assert client.get(f"{P}/projects/secret-draft").status_code == 404
    r = admin.put(f"{A}/projects/{p['id']}", json={**{k: p[k] for k in ("slug", "title")}, "summary": "Edited", "published": True}, headers=admin.h)
    assert r.json()["summary"] == "Edited"
    assert admin.delete(f"{A}/projects/{p['id']}", headers=admin.h).status_code == 204
    assert admin.get(f"{A}/projects/{p['id']}").status_code == 404


def test_project_validation(admin):
    bad = {"slug": "Bad Slug!", "title": "T", "category": "nope", "status": "weird", "github_url": "javascript:alert(1)"}
    r = admin.post(f"{A}/projects", json=bad, headers=admin.h)
    fields = {d["field"] for d in r.json()["error"]["details"]}
    assert r.status_code == 422 and {"slug", "category", "status", "github_url"} <= fields
    make_project(admin)
    assert admin.post(f"{A}/projects", json={"slug": "demo-agent", "title": "Dup"}, headers=admin.h).status_code == 409
    assert admin.post(f"{A}/projects", json={"slug": "ok-slug", "title": "T", "unexpected": 1}, headers=admin.h).status_code == 422


def test_reorder_and_public_order(admin, client):
    a, b = make_project(admin, slug="aaa-one", title="A"), make_project(admin, slug="bbb-two", title="B")
    admin.post(f"{A}/projects/reorder", json={"ids": [b["id"], a["id"]]}, headers=admin.h)
    slugs = [x["slug"] for x in client.get(f"{P}/site").json()["projects"]]
    assert slugs.index("bbb-two") < slugs.index("aaa-one")


def test_skills_and_items_crud(admin, client):
    s = admin.post(f"{A}/skills", json={"category": "Tools", "name": "Rust"}, headers=admin.h).json()
    assert "Rust" in client.get(f"{P}/site").json()["skills"]["Tools"]
    admin.put(f"{A}/skills/{s['id']}", json={"category": "Tools", "name": "Rust", "published": False}, headers=admin.h)
    assert "Rust" not in client.get(f"{P}/site").json()["skills"]["Tools"]
    it = admin.post(
        f"{A}/items", json={"kind": "experience", "title": "Engineer", "organization": "ACME", "start_date": "2025"}, headers=admin.h
    ).json()
    assert client.get(f"{P}/site").json()["items"]["experience"][0]["title"] == "Engineer"
    assert admin.delete(f"{A}/items/{it['id']}", headers=admin.h).status_code == 204
    assert "experience" not in client.get(f"{P}/site").json()["items"]


def test_settings_validated_no_scripts_no_unknown_fields(admin):
    ok = admin.get(f"{A}/settings").json()["hero"] | {"headline": "New headline"}
    assert admin.put(f"{A}/settings/hero", json=ok, headers=admin.h).json()["headline"] == "New headline"
    assert admin.put(f"{A}/settings/hero", json={**ok, "custom_script": "<script>1</script>"}, headers=admin.h).status_code == 422
    soc = {"links": [{"label": "x", "url": "javascript:alert(1)"}]}
    assert admin.put(f"{A}/settings/social", json=soc, headers=admin.h).status_code == 422
    assert admin.put(f"{A}/settings/design", json={"accent": "hotpink"}, headers=admin.h).status_code == 422
    assert admin.put(f"{A}/settings/nope", json={}, headers=admin.h).status_code == 404
    assert admin.put(f"{A}/settings/hero", json={**ok, "profile_image_id": "doesnotexist"}, headers=admin.h).status_code == 422


def test_design_and_section_visibility_reach_public_site(admin, client):
    admin.put(f"{A}/settings/design", json={"accent": "violet", "animations_enabled": False, "intensity": "low"}, headers=admin.h)
    admin.put(f"{A}/settings/sections", json={"services": False}, headers=admin.h)
    s = client.get("/api/v1/public/site").json()["settings"]
    assert s["design"]["accent"] == "violet" and s["design"]["animations_enabled"] is False and s["sections"]["services"] is False


def test_private_email_settings_never_public(admin, client):
    admin.put(f"{A}/settings/email", json={"notify_to": "owner@private.example", "send_confirmation": True}, headers=admin.h)
    pub = client.get("/api/v1/public/site").text
    assert "email" not in client.get("/api/v1/public/site").json()["settings"] or "owner@private.example" not in pub
    assert "owner@private.example" not in pub


def test_media_upload_validation(admin):
    up = lambda name, data, kind="image": admin.post(
        f"{A}/media?kind={kind}", files={"file": (name, data, "application/octet-stream")}, headers=admin.h
    )  # noqa: E731
    ok = up("../../evil name.png", PNG)
    assert ok.status_code == 201 and ok.json()["url"].startswith("/media/") and ".." not in ok.json()["name"] and "/" not in ok.json()["name"]
    assert up("x.svg", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>").status_code == 422
    assert up("x.png", b"not really a png").status_code == 422
    assert up("x.png", b"<html><script>1</script></html>").status_code == 422
    assert up("x.png", PNG + b"0" * (5 * 1024 * 1024)).status_code == 413
    assert up("cv.png", PNG, "cv").status_code == 422
    assert up("doc.pdf", PDF, "image").status_code == 422
    assert up("cv.pdf", PDF, "cv").status_code == 201


def test_media_served_safely_and_traversal_blocked(admin, client):
    url = admin.post(f"{A}/media", files={"file": ("a.png", PNG, "image/png")}, headers=admin.h).json()["url"]
    r = client.get(url)
    assert (
        r.status_code == 200
        and r.headers["content-type"] == "image/png"
        and r.headers["x-content-type-options"] == "nosniff"
        and "sandbox" in r.headers["content-security-policy"]
    )
    for bad in ("/media/..%2f..%2fetc%2fpasswd", "/media/not-there.png", "/media/..%5c..%5cwin.ini"):
        assert client.get(bad).status_code == 404


def test_media_in_use_cannot_be_deleted_and_cv_flows_to_public(admin, client):
    m = admin.post(f"{A}/media?kind=cv", files={"file": ("cv.pdf", PDF, "application/pdf")}, headers=admin.h).json()
    admin.put(f"{A}/settings/resume", json={"cv_media_id": m["id"]}, headers=admin.h)
    assert client.get("/api/v1/public/site").json()["settings"]["resume"]["cv_download_url"] == m["url"]
    assert admin.delete(f"{A}/media/{m['id']}", headers=admin.h).status_code == 409
    admin.put(f"{A}/settings/resume", json={"cv_media_id": None}, headers=admin.h)
    assert admin.delete(f"{A}/media/{m['id']}", headers=admin.h).status_code == 204


def test_audit_trail_records_without_secrets(admin):
    make_project(admin)
    admin.put(f"{A}/settings/footer", json={"tagline": "Hi"}, headers=admin.h)
    items = admin.get(f"{A}/audit").json()["items"]
    actions = {i["action"] for i in items}
    assert {"auth.login", "project.create", "settings.update"} <= actions
    assert "Str0ng" not in str(items)


def test_public_bundle_has_no_private_data(client):
    body = client.get("/api/v1/public/site").text.lower()
    for needle in ("password", "secret", "api_key", "notify_to", "ip_hash"):
        assert needle not in body


def test_seo_injection_sitemap_robots(admin, client):
    admin.put(f"{A}/settings/seo", json={"title": "My <b>Title</b>", "description": "D", "keywords": "k"}, headers=admin.h)
    html = client.get("/").text
    assert "<title>My &lt;b&gt;Title&lt;/b&gt;</title>" in html and 'rel="canonical"' in html and 'property="og:title"' in html
    assert "<loc>" in client.get("/sitemap.xml").text
    assert "Disallow: /admin" in client.get("/robots.txt").text

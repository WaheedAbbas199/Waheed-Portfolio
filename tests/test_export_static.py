import json
import sys

from scripts.export_static import main
from tests.conftest import PNG


def run(monkeypatch, tmp_path, *args):
    monkeypatch.setattr(sys, "argv", ["export_static", "--out", str(tmp_path / "site"), *args])
    assert main() == 0
    return tmp_path / "site"


def test_export_is_self_contained_and_has_no_old_hosted_urls(monkeypatch, tmp_path):
    out = run(monkeypatch, tmp_path)
    for f in ("index.html", "config.js", "vercel.json", "data/site.json", "js/main.js", "vendor/three.module.min.js", "css/app.css"):
        assert (out / f).exists(), f
    snap = json.loads((out / "data/site.json").read_text())
    assert snap["projects"] and snap["settings"]["hero"]["name"] == "Waheed Abbas"
    text = "".join((out / f).read_text() for f in ("index.html", "config.js", "vercel.json", "data/site.json"))
    assert "vercel.app" not in text and "blush" not in text.lower()
    assert 'window.PORTFOLIO_CONFIG = { apiBase: "" }' in (out / "config.js").read_text()
    assert "<!--SEO_META-->" not in (out / "index.html").read_text() and "canonical" not in (out / "index.html").read_text()


def test_export_with_api_base_and_site_url(monkeypatch, tmp_path):
    out = run(monkeypatch, tmp_path, "--api-base", "https://api.example.com/", "--site-url", "https://me.example.com")
    assert 'apiBase: "https://api.example.com"' in (out / "config.js").read_text()
    csp = json.loads((out / "vercel.json").read_text())["headers"][0]["headers"][0]["value"]
    assert "connect-src 'self' https://api.example.com" in csp
    assert 'rel="canonical" href="https://me.example.com/"' in (out / "index.html").read_text()
    assert "Sitemap: https://me.example.com/sitemap.xml" in (out / "robots.txt").read_text()


def test_export_from_db_writes_uploaded_media_and_uses_real_content(monkeypatch, tmp_path):
    from app.core.config import get_settings
    from app.main import build_container
    from app.models.enums import MediaKind
    from app.services import media_service
    from app.services.seed import seed_defaults

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/real.db")
    get_settings.cache_clear()
    c = build_container(get_settings(), create_tables=True)
    with c.session_factory() as s:
        seed_defaults(s)
        asset = media_service.save_upload(s, data=PNG, original_name="me.png", kind=MediaKind.IMAGE)
        s.commit()
        stored = asset.stored_name
    out = run(monkeypatch, tmp_path, "--from-db")
    assert (out / "media" / stored).read_bytes() == PNG
    get_settings.cache_clear()


def test_cv_can_be_a_same_site_path_but_not_a_script_url(admin):
    base = admin.get("/api/v1/admin/settings").json()["resume"]
    assert admin.put("/api/v1/admin/settings/resume", json={**base, "cv_url": "/assets/resume/cv.pdf"}, headers=admin.h).status_code == 200
    assert admin.put("/api/v1/admin/settings/resume", json={**base, "cv_url": "javascript:alert(1)"}, headers=admin.h).status_code == 422
    assert admin.get("/api/v1/public/site").json()["settings"]["resume"]["cv_download_url"] == "/assets/resume/cv.pdf"

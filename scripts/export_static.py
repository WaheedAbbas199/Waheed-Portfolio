"""Build the deployable STATIC copy of the public site (no server needed to show your content).

    python -m scripts.export_static --out vercel-site --from-db --site-url https://your-site.vercel.app
    python -m scripts.export_static --out vercel-site                      # seed content instead of your database

Writes into --out:
  index.html + css/js/vendor/assets   the public site (SEO meta filled in from your settings)
  data/site.json                      snapshot of ALL published content (this is what visitors see on a static host)
  media/*                             uploaded images / CV from your database (only with --from-db)
  config.js                           apiBase (empty = static only; set --api-base to enable chatbot + contact form)
  vercel.json                         security headers (CSP allows only this site and, if given, your API origin)
Re-run after every content change in the admin, then redeploy."""

import argparse
import html
import json
import re
import shutil
from pathlib import Path

from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.main import PUBLIC_DIR, build_container
from app.models import MediaAsset
from app.services import content_service
from app.services.seed import seed_defaults


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="vercel-site")
    ap.add_argument("--api-base", default="", help="https origin of your backend (optional; empty = static-only site)")
    ap.add_argument("--site-url", default="", help="public URL of the deployed site (optional; enables canonical/sitemap)")
    ap.add_argument("--from-db", action="store_true", help="read content + uploads from DATABASE_URL instead of the seed defaults")
    a = ap.parse_args()
    api_base = a.api_base.rstrip("/")
    settings = get_settings() if a.from_db else Settings(_env_file=None, app_env="test", database_url="sqlite://", secret_key="x" * 40)
    c = build_container(settings, create_tables=not a.from_db)
    out = Path(a.out)
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(PUBLIC_DIR, out)
    with c.session_factory() as s:
        if not a.from_db:
            seed_defaults(s)
        bundle = content_service.public_bundle(s)
        media_count = 0
        if a.from_db:
            (out / "media").mkdir(exist_ok=True)
            for m in s.scalars(select(MediaAsset)):
                (out / "media" / m.stored_name).write_bytes(m.data)
                media_count += 1
    seo = bundle["settings"]["seo"]
    e = html.escape
    meta = [
        f"<title>{e(seo['title'])}</title>",
        f'<meta name="description" content="{e(seo["description"])}">',
        f'<meta name="keywords" content="{e(seo["keywords"])}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{e(seo["title"])}">',
        f'<meta property="og:description" content="{e(seo["description"])}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    base = a.site_url.rstrip("/")
    if base:
        meta += [f'<link rel="canonical" href="{e(base)}/">', f'<meta property="og:url" content="{e(base)}/">']
        if seo.get("og_image_url"):
            meta.append(f'<meta property="og:image" content="{e(base + seo["og_image_url"])}">')
        (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
        (out / "sitemap.xml").write_text(
            f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{e(base)}/</loc></url></urlset>',
            encoding="utf-8",
        )
    else:
        (out / "robots.txt").write_text("User-agent: *\nAllow: /\n", encoding="utf-8")
    index = (out / "index.html").read_text(encoding="utf-8")
    (out / "index.html").write_text(re.sub(r"<!--SEO_META-->", "\n  ".join(meta), index), encoding="utf-8")
    (out / "data").mkdir(exist_ok=True)
    (out / "data" / "site.json").write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    (out / "config.js").write_text(f"window.PORTFOLIO_CONFIG = {{ apiBase: {json.dumps(api_base)} }};\n", encoding="utf-8")
    connect = f"'self' {api_base}".strip()
    csp = (
        f"default-src 'self'; img-src 'self' data: blob: {api_base}; style-src 'self'; script-src 'self'; connect-src {connect}; font-src 'self'; media-src 'self'; "
        "object-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:"
    ).replace("  ", " ")
    vercel = {
        "headers": [
            {
                "source": "/(.*)",
                "headers": [
                    {"key": "Content-Security-Policy", "value": csp},
                    {"key": "X-Content-Type-Options", "value": "nosniff"},
                    {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
                    {"key": "Permissions-Policy", "value": "camera=(), geolocation=(), microphone=(self)"},
                ],
            },
            {"source": "/vendor/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]},
            {"source": "/data/(.*)", "headers": [{"key": "Cache-Control", "value": "no-cache"}]},
        ]
    }
    (out / "vercel.json").write_text(json.dumps(vercel, indent=2), encoding="utf-8")
    mode = f"static + backend at {api_base}" if api_base else "static-only (contact form falls back to email, chatbot hidden)"
    print(f"Wrote {out}/  ·  {len(bundle['projects'])} projects, {media_count} uploaded files  ·  mode: {mode}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# Deployment (Vercel, step by step)

## Why the old deploy showed nothing
The site needs content from `/api/v1/public/site`. Locally the Python server provides it; on Vercel there is no Python server, so that URL answers **404** and the page used to stop.
Now the site ships its own copy of your content (`data/site.json`) and falls back to it automatically, so **a plain Vercel deploy always shows your portfolio**.

## Mode A — static site only (simplest, works immediately)
Shows everything: hero, about, skills, projects, experience, services, résumé, theme toggle, 3D, animations.
The **contact form turns into an email link** and the **chatbot is hidden** (they need a backend).

1. The folder **`vercel-site/`** in this project is already built. Push the project to GitHub.
2. Vercel → *Add New → Project* → import the repo.
3. Set **Root Directory = `vercel-site`**, **Framework Preset = Other**, leave **Build Command** and **Output Directory** empty → **Deploy**.
   (Alternative without GitHub: `cd vercel-site` then `npx vercel --prod`.)
4. Open the Vercel URL. If you see an old version, hard-refresh (Ctrl+Shift+R).

### Updating content (projects, skills, text, images, CV)
1. Run locally (see README), open `http://localhost:8000/admin`, edit and **publish**.
2. Rebuild the deployable folder from your local database:
   ```powershell
   python -m scripts.export_static --out vercel-site --from-db --site-url https://YOUR-SITE.vercel.app
   ```
   This copies your published content **and uploaded images/CV** into `vercel-site/`.
3. Commit and push → Vercel redeploys automatically.

No local database yet? `python -m scripts.export_static --out vercel-site` rebuilds from the starter content.

## Mode B — static site + backend (chatbot and contact form go live)
1. Deploy the backend (FastAPI + PostgreSQL) on a Python host (Render, Railway, Fly.io, a VPS…).
   Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers`. Before first start: `alembic upgrade head`; then `python -m scripts.create_admin --email you@example.com` once.
   Environment (see `.env.example`): `APP_ENV=production`, strong `SECRET_KEY`, `DATABASE_URL`, `PUBLIC_ORIGINS=https://YOUR-SITE.vercel.app`, `SITE_URL=https://YOUR-API-HOST`, `GEMINI_API_KEY`, email settings.
2. Rebuild the static folder pointing at it:
   ```powershell
   python -m scripts.export_static --out vercel-site --from-db --api-base https://YOUR-API-HOST --site-url https://YOUR-SITE.vercel.app
   ```
   This sets `config.js` and a CSP that allows exactly your site and your API.
3. Redeploy `vercel-site/`. Admin is then at `https://YOUR-API-HOST/admin`.

> Platform limits, sleep behaviour and pricing change; check your host's current docs. Nothing here was deployed from this environment.

## Docker Compose (single server)
`docker compose up -d db` → `docker compose --profile tools run --rm migrate` → `docker compose up -d app` → create admin. Put Caddy/nginx in front for HTTPS.

## Backups & recovery
`pg_dump -Fc` regularly (managed hosts offer snapshots); restore with `pg_restore --clean --if-exists`. Roll back a migration with `alembic downgrade -1` after a backup.

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Vercel page is blank or 404 | Root Directory is not `vercel-site` (index.html must be at the root of the deployed folder) |
| Old content still showing | Rebuild with `export_static`, push, hard-refresh |
| Images/CV missing on Vercel | Re-run `export_static` with `--from-db` (it copies uploads into `vercel-site/media/`) |
| Contact form shows an email link | Expected in Mode A; use Mode B for the live form |
| Chatbot missing | Expected in Mode A; Mode B needs the backend + `GEMINI_API_KEY` |
| Mode B: form/chat fail | `apiBase` in `config.js`, backend `PUBLIC_ORIGINS`, and HTTPS on both sides must match |
| 3D background missing | Reduced-motion / Save-Data / low-end device / no WebGL, or disabled in Admin → Design (by design) |

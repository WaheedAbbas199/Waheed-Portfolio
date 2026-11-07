# Implementation report (honest status)

| Phase | Status | Evidence |
|---|---|---|
| 1 Audit existing repo | **Blocked** — repo not accessible; live site inspected instead | see MIGRATION doc |
| 2 Backend, config, DB, migrations | Done | `alembic upgrade head` verified on fresh SQLite (PostgreSQL not run) |
| 3 Private admin auth | Done | `tests/test_auth.py` |
| 4 Admin dashboard & content management | Done | `tests/test_admin_content.py`; live curl flow |
| 5 Public site from published content | Done | live flow: created project via API → appeared publicly |
| 6 Animations, 3D, responsive, design settings | Done in code; **not visually verified in a real browser** | jsdom + CSS tests only |
| 7 Chatbot text + voice | Backend + UI done; Gemini **mock-tested only**; voice uses browser APIs (not testable here) | `test_contact_chat.py`, `util.test.mjs` |
| 8 Contact + email | Done; Resend/SMTP **mock-tested only** | tests |
| 9 Security hardening & tests | Done within limits (see SECURITY.md) | 73 backend + 21 frontend tests, ruff clean |
| 10 Deployment | Config & docs written; **not deployed or built in Docker here** | — |

## Not verified / outstanding
* Visual QA on phones/desktops, 3D performance on real devices, and dark/light contrast by eye.
* Live Gemini (model availability/quotas) and live email delivery (domain verification).
* Docker build, PostgreSQL migration, HTTPS, and the actual Vercel deployment (the static-host behaviour is covered by an automated test that serves `vercel-site/` with a plain static server).
* Import of your real `data.js` content, CV upload, profile image, project thumbnails, and verified project links/results.
* Seeded projects have empty case-study fields on purpose.

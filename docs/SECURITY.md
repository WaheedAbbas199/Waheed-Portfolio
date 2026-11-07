# Security

| Area | Implementation | Verified by |
|---|---|---|
| Admin auth | bcrypt, 12+ char policy, HttpOnly + SameSite=Strict (+Secure in production) cookie, 8 h expiry, login rate limit, generic errors | `tests/test_auth.py` |
| No public signup | no registration endpoint; admin created via CLI only; owner-controlled password reset CLI | `test_there_is_no_public_registration` |
| CSRF | header must equal the value inside the signed session on every non-GET admin request | `test_csrf_required_on_writes` |
| Authorization | every admin route depends on the session check (parametrised test over routes); inactive admin invalidates session immediately | tests |
| Input validation | Pydantic, length limits, `extra=forbid`, http(s)-only URLs, enum fields | tests |
| XSS | frontend never uses `innerHTML`; strict CSP (`script-src 'self'`); emails HTML-escape visitor content | `dom.test.mjs`, `test_hostile_content…` |
| Uploads | content sniffing (PNG/JPEG/WebP/GIF/PDF only, **no SVG**), size caps, random names, path-traversal blocked, in-use files can't be deleted | `test_media_*` |
| Chatbot | published-only knowledge, injection patterns refused without calling the model, data fenced in random delimiters, URL allow-list on output, rate + size + daily limits, key server-side only | `test_contact_chat.py` |
| Contact | honeypot, minimum-time check, per-IP limit, dedupe, header-injection stripping, message stored before email | tests |
| Secrets | env vars only; production refuses weak `SECRET_KEY` / wildcard origins; logs redact keys/tokens | tests |
| Headers | CSP, nosniff, frame options, referrer & permissions policy, HSTS (production), admin `no-store` + `noindex` | tests |

## Known limitations (do before relying on this for sensitive data)
* No MFA; single admin account model. Rotate `SECRET_KEY` to revoke all sessions.
* Rate limiters are per process. Public IPs behind a proxy require `--proxy-headers` and a firewall so clients can't spoof `X-Forwarded-For`.
* Visitor names/emails are stored in plaintext in your database; define a retention policy (delete from Admin → Messages) and review privacy-law obligations for your audience.
* No automated dependency scan yet (`pip-audit`, `npm audit` recommended in CI). No penetration test has been performed.
* Browser speech recognition may send audio to the browser vendor's service; the UI only starts it after a click.

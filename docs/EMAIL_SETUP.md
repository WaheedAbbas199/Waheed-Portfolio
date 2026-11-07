# Email notifications

Messages are always saved first. Email is optional and best-effort; the admin inbox shows each message's notification status and lets you **retry failed ones**.

## Option A — Resend (HTTPS API)
1. Create an account at resend.com and an API key.
2. **Sender domain:** to send from your own address you must verify a domain in Resend (DNS records). Until then, Resend's test sender (`onboarding@resend.dev`) can only deliver to the account owner's own email — check Resend's current rules.
3. Set environment variables: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=…`, `EMAIL_FROM="Portfolio <you@yourdomain.com>"`, `NOTIFY_EMAIL=waheedabbass2211@gmail.com`.

## Option B — SMTP (e.g. a Gmail app password)
`EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_STARTTLS=true`, `EMAIL_FROM`, `NOTIFY_EMAIL`. Use an app-specific password, never your main password.

## Visitor confirmation (optional)
Admin → Email & site → "Send a confirmation email to visitors". Off by default; only sent after a successful owner notification and only when a provider is configured.

## Troubleshooting
* Inbox shows `disabled` → no provider configured. `failed` → open the message to see the provider error (no secrets are shown), fix config, press **Retry email**.
* A message already `sent` is never re-sent (protects against duplicate notifications).

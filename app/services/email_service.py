"""Contact notifications. The message is ALWAYS stored first; email is best-effort with recorded status.
Providers: Resend (HTTPS API) or SMTP. Secrets come from the environment only."""

import html
import re
import smtplib
from email.message import EmailMessage
from typing import Protocol

import httpx
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.logging import get_logger
from app.models import ContactMessage, EmailAttempt
from app.models.enums import EmailStatus
from app.services import content_service

log = get_logger(__name__)
_CRLF = re.compile(r"[\r\n\t]+")


class EmailError(Exception):
    pass


class Provider(Protocol):
    name: str

    def send(self, *, to: str, subject: str, text: str, html_body: str, reply_to: str | None, sender: str) -> None: ...


class ResendProvider:
    name = "resend"

    def __init__(self, api_key: str, transport: httpx.BaseTransport | None = None):
        self._key = api_key
        self._client = httpx.Client(timeout=10.0, transport=transport)

    def send(self, *, to, subject, text, html_body, reply_to, sender) -> None:
        payload = {"from": sender, "to": [to], "subject": subject, "text": text, "html": html_body}
        if reply_to:
            payload["reply_to"] = reply_to
        try:
            r = self._client.post("https://api.resend.com/emails", json=payload, headers={"Authorization": f"Bearer {self._key}"})
        except httpx.HTTPError as exc:
            raise EmailError(f"network error: {type(exc).__name__}") from exc
        if r.status_code >= 300:
            raise EmailError(f"provider rejected the request (HTTP {r.status_code})")


class SMTPProvider:
    name = "smtp"

    def __init__(self, s: Settings):
        self.s = s

    def send(self, *, to, subject, text, html_body, reply_to, sender) -> None:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = sender, to, subject
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.set_content(text)
        msg.add_alternative(html_body, subtype="html")
        try:
            with smtplib.SMTP(self.s.smtp_host, self.s.smtp_port, timeout=10) as smtp:
                if self.s.smtp_starttls:
                    smtp.starttls()
                if self.s.smtp_user:
                    smtp.login(self.s.smtp_user, self.s.smtp_password)
                smtp.send_message(msg)
        except (smtplib.SMTPException, OSError) as exc:
            raise EmailError(f"smtp error: {type(exc).__name__}") from exc


def build_provider(s: Settings) -> Provider | None:
    if not s.email_configured:
        return None
    return ResendProvider(s.resend_api_key) if s.email_provider == "resend" else SMTPProvider(s)


def _clean_header(v: str, limit: int = 150) -> str:
    return _CRLF.sub(" ", v).strip()[:limit]


def _render_notification(m: ContactMessage, prefix: str) -> tuple[str, str, str]:
    subject = _clean_header(f"{prefix} {m.category}: {m.subject}")
    text = f"New portfolio message\n\nFrom: {m.name} <{m.email}>\nCategory: {m.category}\nSubject: {m.subject}\n\n{m.message}\n"
    e = html.escape
    body = (
        f"<h2>New portfolio message</h2><p><b>From:</b> {e(m.name)} &lt;{e(m.email)}&gt;<br><b>Category:</b> {e(m.category)}<br>"
        f'<b>Subject:</b> {e(m.subject)}</p><pre style="white-space:pre-wrap;font-family:inherit">{e(m.message)}</pre>'
    )
    return subject, text, body


def send_notification(session: Session, settings: Settings, provider: Provider | None, message_id: str) -> EmailStatus:
    """Idempotent: a message already marked 'sent' is never re-sent (protects against double notifications)."""
    m = session.get(ContactMessage, message_id)
    if m is None:
        return EmailStatus.FAILED
    if m.email_status == EmailStatus.SENT:
        return EmailStatus.SENT
    prefs = content_service.get_group(session, "email")
    to = prefs["notify_to"] or settings.notify_email
    if provider is None or not to:
        m.email_status = EmailStatus.DISABLED
        session.commit()
        return EmailStatus.DISABLED
    subject, text, body = _render_notification(m, prefs["subject_prefix"])
    sender = settings.email_from
    ok, err = True, None
    try:
        provider.send(to=to, subject=subject, text=text, html_body=body, reply_to=m.email, sender=sender)
    except EmailError as exc:
        ok, err = False, str(exc)[:300]
        log.warning("notification failed for message %s: %s", m.id, err)
    session.add(EmailAttempt(message_id=m.id, kind="notification", provider=provider.name, ok=ok, error=err))
    m.email_status = EmailStatus.SENT if ok else EmailStatus.FAILED
    session.commit()
    if ok and prefs["send_confirmation"]:
        send_confirmation(session, provider, m, prefs, sender)
    return m.email_status


def send_confirmation(session: Session, provider: Provider, m: ContactMessage, prefs: dict, sender: str) -> None:
    if m.confirmation_status == EmailStatus.SENT:
        return
    e = html.escape
    text = f"Hi {m.name},\n\nThanks for your message - I've received it and will reply soon.\n\nYour message:\n{m.message}\n"
    body = f"<p>Hi {e(m.name)},</p><p>Thanks for your message — I've received it and will reply soon.</p>"
    ok, err = True, None
    try:
        provider.send(to=m.email, subject=_clean_header("Thanks for reaching out"), text=text, html_body=body, reply_to=None, sender=sender)
    except EmailError as exc:
        ok, err = False, str(exc)[:300]
    session.add(EmailAttempt(message_id=m.id, kind="confirmation", provider=provider.name, ok=ok, error=err))
    m.confirmation_status = EmailStatus.SENT if ok else EmailStatus.FAILED
    session.commit()

from sqlalchemy.orm import Session

from app.models import AuditLog

_SENSITIVE = {"password", "token", "api_key", "secret", "authorization", "message", "email"}


def audit(
    session: Session, *, actor_id: str | None, action: str, entity_type: str, entity_id: str | None = None, details: dict | None = None
) -> None:
    clean = {k: v for k, v in (details or {}).items() if k.lower() not in _SENSITIVE}
    session.add(AuditLog(actor_id=actor_id, action=action, entity_type=entity_type, entity_id=entity_id, details=clean))

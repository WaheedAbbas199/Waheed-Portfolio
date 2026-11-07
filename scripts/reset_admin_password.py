"""Owner-controlled recovery (no email reset flow, so nobody else can trigger it):
    python -m scripts.reset_admin_password --email you@example.com
Requires shell/database access to the server, which only the owner has."""

import argparse
import getpass
import os
import sys

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password, validate_password_strength
from app.db.session import make_engine, make_session_factory
from app.models import AdminUser


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    a = p.parse_args()
    pw = os.environ.get("PF_ADMIN_PASSWORD") or getpass.getpass("New password: ")
    try:
        validate_password_strength(pw)
    except ValueError as exc:
        print(f"Weak password: {exc}")
        return 2
    with make_session_factory(make_engine(get_settings()))() as s:
        admin = s.scalar(select(AdminUser).where(AdminUser.email == a.email.lower().strip()))
        if not admin:
            print("No such admin")
            return 1
        admin.password_hash, admin.is_active = hash_password(pw), True
        s.commit()
    print("Password updated. Existing sessions stay valid until they expire; rotate SECRET_KEY to revoke them all.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

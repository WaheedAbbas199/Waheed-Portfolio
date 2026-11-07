"""Create the owner's admin account (only allowed when no admin exists, unless --force).
    python -m scripts.create_admin --email you@example.com
Password is read interactively or from PF_ADMIN_PASSWORD. Nothing is hard-coded; there is no public registration endpoint."""

import argparse
import getpass
import os
import sys

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import hash_password, validate_password_strength
from app.db.session import make_engine, make_session_factory
from app.models import AdminUser
from app.services.seed import seed_defaults


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    p.add_argument("--force", action="store_true", help="create an additional admin even if one exists")
    a = p.parse_args()
    pw = os.environ.get("PF_ADMIN_PASSWORD") or getpass.getpass("Password (12+ chars, upper/lower/digit): ")
    try:
        validate_password_strength(pw)
    except ValueError as exc:
        print(f"Weak password: {exc}")
        return 2
    with make_session_factory(make_engine(get_settings()))() as s:
        seed_defaults(s)
        if s.scalar(select(func.count()).select_from(AdminUser)) and not a.force:
            print("An admin already exists. Use scripts.reset_admin_password to change the password (or --force to add another).")
            return 1
        s.add(AdminUser(email=a.email.lower().strip(), password_hash=hash_password(pw)))
        s.commit()
    print(f"Admin created: {a.email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

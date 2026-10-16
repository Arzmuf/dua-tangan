"""The first admin account, from the ADMIN_EMAIL and ADMIN_PASSWORD settings."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import User
from ..security import hash_password, verify_password

log = logging.getLogger(__name__)


def ensure_admin(db: Session) -> None:
    """Creates the admin if the account doesn't exist. An existing account is only promoted when its
    password matches ADMIN_PASSWORD, so signing up with that email first doesn't make anyone an admin."""
    if not (settings.admin_email and settings.admin_password):
        return
    email = settings.admin_email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        db.add(User(email=email, full_name="Admin", password_hash=hash_password(settings.admin_password), is_admin=True))
    elif not user.is_admin:
        if not verify_password(settings.admin_password, user.password_hash):
            log.warning("ADMIN_EMAIL %s is an existing account with another password, so it was not made an admin.", email)
            return
        user.is_admin = True
    db.commit()

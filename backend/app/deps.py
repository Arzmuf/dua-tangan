from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import Family, User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)

DEACTIVATED = "This account has been deactivated. Contact Dua Tangan support if you think this is a mistake."


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in first.")
    user = db.get(User, decode_token(creds.credentials))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Please sign in again.")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, DEACTIVATED)
    return user


def get_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can do that.")
    return user


@dataclass
class Ctx:
    """The signed-in parent, their family and the co-parent (None until they join)."""

    db: Session
    user: User
    family: Family
    partner: User | None


def get_ctx(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Ctx:
    if user.family_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Create or join a family first.")
    family = db.get(Family, user.family_id)
    partner = next((m for m in family.members if m.id != user.id), None)
    return Ctx(db=db, user=user, family=family, partner=partner)

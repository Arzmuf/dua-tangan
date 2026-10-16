from datetime import timedelta

import bcrypt
import jwt
from fastapi import HTTPException, status

from .config import settings
from .models import utcnow

ALGORITHM = "HS256"


def _password_bytes(password: str) -> bytes:
    # bcrypt only looks at the first 72 bytes and bcrypt>=5 refuses longer input.
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(_password_bytes(password), password_hash.encode())


def create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": utcnow() + timedelta(days=settings.jwt_expires_days)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        if "doc" in payload:  # a download link, not a sign-in
            raise ValueError
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Please sign in again.")


# Documents open in the browser, which can't send the app's bearer token, so the app asks for a
# short-lived link that only works for that one file.
FILE_LINK_MINUTES = 5


def create_file_token(user_id: int, document_id: int) -> str:
    payload = {"sub": str(user_id), "doc": document_id, "exp": utcnow() + timedelta(minutes=FILE_LINK_MINUTES)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_file_token(token: str, document_id: int) -> int:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        if payload.get("doc") != document_id:
            raise ValueError
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This link has expired. Open the document again from the app.")

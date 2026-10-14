from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import AuthOut, LoginIn, MeOut, RegisterIn, UpdateMeIn
from ..security import create_token, hash_password, verify_password
from ..serializers import me_out

router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(email=email, full_name=data.full_name, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    return AuthOut(access_token=create_token(user.id), me=me_out(user))


@router.post("/auth/login", response_model=AuthOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    return AuthOut(access_token=create_token(user.id), me=me_out(user))


@router.get("/me", response_model=MeOut)
def read_me(user: User = Depends(get_current_user)):
    return me_out(user)


@router.patch("/me", response_model=MeOut)
def update_me(data: UpdateMeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.full_name = data.full_name
    db.commit()
    return me_out(user)

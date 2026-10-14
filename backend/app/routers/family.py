import secrets
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Ctx, get_ctx, get_current_user
from ..fmt import DEFAULT_TZ
from ..models import Child, Family, User
from ..schemas import ChildIn, ChildOut, CreateFamilyIn, FamilyOut, JoinFamilyIn, MeOut
from ..serializers import family_out, me_out
from ..services.record import log_event

router = APIRouter(tags=["family"])

# No 0/O or 1/I so codes survive being read out over the phone.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_invite_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if not db.scalar(select(Family.id).where(Family.invite_code == code)):
            return code


def valid_time_zone(name: str | None) -> str:
    try:
        ZoneInfo(name or DEFAULT_TZ)
        return name or DEFAULT_TZ
    except Exception:
        return DEFAULT_TZ


def get_child(ctx: Ctx, child_id: int) -> Child:
    child = ctx.db.get(Child, child_id)
    if child is None or child.family_id != ctx.family.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found.")
    return child


@router.post("/families", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def create_family(data: CreateFamilyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.family_id is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already part of a family.")
    family = Family(
        name=f"{data.child_name}'s family",
        invite_code=new_invite_code(db),
        time_zone=valid_time_zone(data.time_zone),
    )
    family.children.append(Child(name=data.child_name, birth_date=data.child_birth_date))
    user.family = family
    db.add(family)
    db.flush()
    log_event(db, family.id, user, "family", f"Family space created by {user.first_name} for {data.child_name}")
    db.commit()
    return me_out(user)


@router.post("/families/join", response_model=MeOut)
def join_family(data: JoinFamilyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.family_id is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already part of a family.")
    code = data.invite_code.replace(" ", "").upper()
    family = db.scalar(select(Family).where(Family.invite_code == code))
    if family is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We couldn't find a family with that code.")
    if len(family.members) >= 2:
        raise HTTPException(status.HTTP_409_CONFLICT, "This family already has two parents.")
    user.family = family
    db.flush()
    log_event(db, family.id, user, "family", f"{user.first_name} joined the family space")
    db.commit()
    return me_out(user)


@router.get("/family", response_model=FamilyOut)
def read_family(ctx: Ctx = Depends(get_ctx)):
    return family_out(ctx.family)


@router.post("/family/children", response_model=ChildOut, status_code=status.HTTP_201_CREATED)
def add_child(data: ChildIn, ctx: Ctx = Depends(get_ctx)):
    child = Child(family_id=ctx.family.id, name=data.name, birth_date=data.birth_date)
    ctx.db.add(child)
    log_event(ctx.db, ctx.family.id, ctx.user, "family", f"Child added by {ctx.user.first_name} — {data.name}")
    ctx.db.commit()
    return child


@router.patch("/family/children/{child_id}", response_model=ChildOut)
def update_child(child_id: int, data: ChildIn, ctx: Ctx = Depends(get_ctx)):
    child = get_child(ctx, child_id)
    child.name = data.name
    child.birth_date = data.birth_date
    log_event(ctx.db, ctx.family.id, ctx.user, "family", f"Child details updated by {ctx.user.first_name} — {data.name}")
    ctx.db.commit()
    return child

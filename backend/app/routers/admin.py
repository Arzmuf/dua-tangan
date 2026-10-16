from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_admin
from ..models import Booking, Family, Program, User, utcnow
from ..schemas import (
    AdminBookingOut,
    AdminFamilyOut,
    AdminProgramOut,
    AdminStatsOut,
    AdminUserIn,
    AdminUserOut,
    AdminUserUpdate,
    ProgramIn,
)
from ..security import hash_password
from ..serializers import program_out

router = APIRouter(prefix="/admin", tags=["admin"])


def user_out(u: User) -> AdminUserOut:
    return AdminUserOut(
        id=u.id,
        full_name=u.full_name,
        email=u.email,
        is_admin=u.is_admin,
        is_active=u.is_active,
        created_at=u.created_at,
        family=AdminFamilyOut(id=u.family.id, name=u.family.name) if u.family else None,
    )


def admin_program_out(p: Program) -> AdminProgramOut:
    return AdminProgramOut(
        **program_out(p).model_dump(),
        tickets_sold=p.tickets_sold,
        bookings_count=len(p.bookings),
        revenue=sum(b.amount for b in p.bookings),
    )


def find_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    return user


def find_program(db: Session, program_id: int) -> Program:
    program = db.get(Program, program_id)
    if program is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found.")
    return program


def email_taken(db: Session, email: str, except_id: int | None = None) -> bool:
    return db.scalar(select(User.id).where(User.email == email, User.id != except_id)) is not None


@router.get("/stats", response_model=AdminStatsOut)
def stats(_: User = Depends(get_admin), db: Session = Depends(get_db)):
    return AdminStatsOut(
        parents=db.scalar(select(func.count()).select_from(User).where(User.is_admin.is_(False))) or 0,
        families=db.scalar(select(func.count()).select_from(Family)) or 0,
        upcoming_programs=db.scalar(select(func.count()).select_from(Program).where(Program.starts_at > utcnow())) or 0,
        bookings=db.scalar(select(func.count()).select_from(Booking)) or 0,
        revenue=db.scalar(select(func.coalesce(func.sum(Booking.amount), 0))) or 0,
    )


# --- users -----------------------------------------------------------------------------------


@router.get("/users", response_model=list[AdminUserOut])
def list_users(q: str = Query("", max_length=120), _: User = Depends(get_admin), db: Session = Depends(get_db)):
    query = select(User).order_by(User.created_at.desc())
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.where(or_(User.full_name.ilike(like), User.email.ilike(like)))
    return [user_out(u) for u in db.scalars(query.limit(500)).all()]


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: AdminUserIn, _: User = Depends(get_admin), db: Session = Depends(get_db)):
    email = data.email.lower()
    if email_taken(db, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(email=email, full_name=data.full_name, password_hash=hash_password(data.password), is_admin=data.is_admin)
    db.add(user)
    db.commit()
    return user_out(user)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(user_id: int, data: AdminUserUpdate, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    user = find_user(db, user_id)
    if user.id == admin.id and (data.is_admin is False or data.is_active is False):
        raise HTTPException(status.HTTP_409_CONFLICT, "You can't remove your own admin access or deactivate yourself.")
    if data.email is not None:
        email = data.email.lower()
        if email_taken(db, email, except_id=user.id):
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
        user.email = email
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.password is not None:
        user.password_hash = hash_password(data.password)
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    return user_out(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    user = find_user(db, user_id)
    if user.id == admin.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can't delete your own account.")
    # A parent's messages, expenses and record entries belong to the family's sealed history.
    if user.family_id is not None or db.scalar(select(Booking.id).where(Booking.user_id == user.id).limit(1)):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{user.first_name} is part of a family's shared history. Deactivate the account instead.",
        )
    db.delete(user)
    db.commit()


# --- programs --------------------------------------------------------------------------------


@router.get("/programs", response_model=list[AdminProgramOut])
def list_programs(_: User = Depends(get_admin), db: Session = Depends(get_db)):
    return [admin_program_out(p) for p in db.scalars(select(Program).order_by(Program.starts_at.desc())).all()]


@router.get("/programs/{program_id}", response_model=AdminProgramOut)
def read_program(program_id: int, _: User = Depends(get_admin), db: Session = Depends(get_db)):
    return admin_program_out(find_program(db, program_id))


@router.post("/programs", response_model=AdminProgramOut, status_code=status.HTTP_201_CREATED)
def create_program(data: ProgramIn, _: User = Depends(get_admin), db: Session = Depends(get_db)):
    program = Program(**data.model_dump())
    db.add(program)
    db.commit()
    return admin_program_out(program)


@router.put("/programs/{program_id}", response_model=AdminProgramOut)
def update_program(program_id: int, data: ProgramIn, _: User = Depends(get_admin), db: Session = Depends(get_db)):
    program = find_program(db, program_id)
    if data.capacity < program.tickets_sold:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"{program.tickets_sold} tickets are already sold, so capacity can't be lower."
        )
    for field, value in data.model_dump().items():
        setattr(program, field, value)
    db.commit()
    return admin_program_out(program)


@router.delete("/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program(program_id: int, _: User = Depends(get_admin), db: Session = Depends(get_db)):
    program = find_program(db, program_id)
    if program.bookings:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "People have booked this event and bookings are final. Unpublish it instead."
        )
    db.delete(program)
    db.commit()


@router.get("/programs/{program_id}/bookings", response_model=list[AdminBookingOut])
def program_bookings(program_id: int, _: User = Depends(get_admin), db: Session = Depends(get_db)):
    program = find_program(db, program_id)
    return [
        AdminBookingOut(
            id=b.id,
            code=b.code,
            tickets=b.tickets,
            amount=b.amount,
            payment_method=b.payment_method,
            created_at=b.created_at,
            name=b.user.full_name,
            email=b.user.email,
        )
        for b in sorted(program.bookings, key=lambda b: b.created_at)
    ]

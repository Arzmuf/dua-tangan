import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Ctx, get_ctx, get_current_user
from ..fmt import rupiah, when
from ..models import Booking, Program, User, utcnow
from ..schemas import BookingIn, BookingOut, ProgramOut
from ..serializers import booking_out, program_out
from ..services.payments import PaymentDeclined, charge
from ..services.record import log_event

router = APIRouter(tags=["programs"])

CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I lookalikes


def new_code(db: Session) -> str:
    while True:
        code = "SJ-" + "".join(secrets.choice(CODE_CHARS) for _ in range(6))
        if not db.scalar(select(Booking.id).where(Booking.code == code)):
            return code


@router.get("/programs", response_model=list[ProgramOut])
def list_programs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Published programs that haven't started yet, soonest first."""
    programs = db.scalars(
        select(Program)
        .where(Program.is_published.is_(True), Program.starts_at > utcnow())
        .order_by(Program.starts_at)
    ).all()
    return [program_out(p, user.id) for p in programs]


@router.get("/programs/{program_id}", response_model=ProgramOut)
def read_program(program_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    program = db.get(Program, program_id)
    # Someone who booked can still open it after it's unpublished.
    if program is None or not (program.is_published or any(b.user_id == user.id for b in program.bookings)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found.")
    return program_out(program, user.id)


@router.post("/programs/{program_id}/book", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def book(program_id: int, data: BookingIn, ctx: Ctx = Depends(get_ctx)):
    # The row lock stops two parents taking the last spots at the same moment.
    program = ctx.db.scalar(select(Program).where(Program.id == program_id).with_for_update())
    if program is None or not program.is_published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found.")
    if program.starts_at <= utcnow():
        raise HTTPException(status.HTTP_409_CONFLICT, "This event has already started.")
    if not data.accept_no_refunds:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Please confirm you understand bookings are final: no refunds or cancellations."
        )
    if data.tickets > program.spots_left:
        left = program.spots_left
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Only {left} spot{'' if left == 1 else 's'} left." if left else "This event is sold out."
        )

    amount = program.price * data.tickets
    try:
        payment_ref = charge(amount, data.payment_method, program.title) if amount else "FREE"
    except PaymentDeclined as e:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, str(e) or "The payment was declined.")
    booking = Booking(
        program_id=program.id,
        user_id=ctx.user.id,
        code=new_code(ctx.db),
        tickets=data.tickets,
        amount=amount,
        payment_method=data.payment_method,
        payment_ref=payment_ref,
    )
    ctx.db.add(booking)
    tickets = f"{data.tickets} ticket{'' if data.tickets == 1 else 's'}"
    paid = f", {rupiah(amount)}" if amount else ", free"
    log_event(
        ctx.db,
        ctx.family.id,
        ctx.user,
        "support",
        f"Event booked by {ctx.user.first_name} — {program.title}, {when(program.starts_at, ctx.family)} ({tickets}{paid})",
    )
    ctx.db.commit()
    return booking_out(booking)


@router.get("/bookings", response_model=list[BookingOut])
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bookings = db.scalars(
        select(Booking).join(Booking.program).where(Booking.user_id == user.id).order_by(Program.starts_at)
    ).all()
    return [booking_out(b) for b in bookings]

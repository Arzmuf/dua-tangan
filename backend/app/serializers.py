"""Model -> response conversion. The `actions` blocks tell the app which buttons to show the
signed-in parent, so the rules live here and nowhere else."""

from datetime import timedelta

from sqlalchemy import select

from . import schemas
from .deps import Ctx
from .models import Booking, Event, Expense, Family, Message, Program, RecordEntry, User, utcnow

# A handoff can be checked in from 3 hours before it starts until a day after.
CHECK_IN_OPENS = timedelta(hours=3)
CHECK_IN_CLOSES = timedelta(hours=24)


def person(user: User) -> schemas.Person:
    return schemas.Person(id=user.id, name=user.full_name, first_name=user.first_name)


def maybe_person(user: User | None) -> schemas.Person | None:
    return person(user) if user else None


def family_out(family: Family) -> schemas.FamilyOut:
    return schemas.FamilyOut(
        id=family.id,
        name=family.name,
        invite_code=family.invite_code,
        time_zone=family.time_zone,
        members=[person(m) for m in family.members],
        children=[schemas.ChildOut.model_validate(c) for c in family.children],
    )


def me_out(user: User) -> schemas.MeOut:
    return schemas.MeOut(
        user=schemas.UserOut(
            id=user.id, email=user.email, full_name=user.full_name, first_name=user.first_name
        ),
        family=family_out(user.family) if user.family else None,
    )


def event_actions(e: Event, ctx: Ctx) -> schemas.EventActions:
    me = ctx.user.id
    now = utcnow()
    pending = e.status == "pending"
    confirmed = e.status == "confirmed"
    has_change = e.change_starts_at is not None
    return schemas.EventActions(
        confirm=pending and e.created_by_id != me,
        decline=pending and e.created_by_id != me,
        cancel=pending and e.created_by_id == me,
        propose_change=confirmed and not has_change and e.starts_at > now,
        respond_change=confirmed and has_change and e.change_by_id != me,
        check_in=confirmed
        and e.checked_in_at is None
        and e.starts_at - CHECK_IN_OPENS <= now <= e.starts_at + CHECK_IN_CLOSES,
    )


def event_out(e: Event, ctx: Ctx) -> schemas.EventOut:
    change = None
    if e.change_starts_at is not None and e.change_by is not None:
        change = schemas.EventChange(
            starts_at=e.change_starts_at,
            location=e.change_location or e.location,
            reason=e.change_reason,
            by=person(e.change_by),
            at=e.change_at or e.created_at,
        )
    return schemas.EventOut(
        id=e.id,
        starts_at=e.starts_at,
        location=e.location,
        note=e.note,
        status=e.status,
        to_parent=person(e.to_parent),
        created_by=person(e.created_by),
        change=change,
        checked_in_at=e.checked_in_at,
        checked_in_by=maybe_person(e.checked_in_by),
        actions=event_actions(e, ctx),
    )


def expense_debtor(x: Expense, ctx: Ctx) -> User | None:
    """The parent who owes their share: whoever did not pay."""
    for member in ctx.family.members:
        if member.id != x.paid_by_id:
            return member
    return None


def expense_out(x: Expense, ctx: Ctx) -> schemas.ExpenseOut:
    me = ctx.user.id
    debtor = expense_debtor(x, ctx)
    return schemas.ExpenseOut(
        id=x.id,
        title=x.title,
        category=x.category,
        amount=x.amount,
        payer_share=x.payer_share,
        owed_amount=x.owed_amount,
        spent_on=x.spent_on,
        status=x.status,
        paid_by=person(x.paid_by),
        created_by=person(x.created_by),
        debtor=maybe_person(debtor),
        settled_at=x.settled_at,
        created_at=x.created_at,
        actions=schemas.ExpenseActions(
            approve=x.status == "pending" and x.created_by_id != me,
            decline=x.status == "pending" and x.created_by_id != me,
            settle=x.status == "approved" and (me == x.paid_by_id or (debtor is not None and me == debtor.id)),
            delete=x.status == "pending" and x.created_by_id == me,
        ),
    )


def balance_out(ctx: Ctx) -> schemas.BalanceOut:
    approved = ctx.db.scalars(
        select(Expense).where(Expense.family_id == ctx.family.id, Expense.status == "approved")
    ).all()
    total = 0
    for x in approved:
        total += x.owed_amount if x.paid_by_id == ctx.user.id else -x.owed_amount
    return schemas.BalanceOut(amount=total, partner=maybe_person(ctx.partner))


def message_out(m: Message, ctx: Ctx) -> schemas.MessageOut:
    return schemas.MessageOut(
        id=m.id,
        body=m.body,
        tone=m.tone,
        is_urgent=m.is_urgent,
        created_at=m.created_at,
        read_at=m.read_at,
        sender=person(m.sender),
        mine=m.sender_id == ctx.user.id,
    )


def entry_out(r: RecordEntry) -> schemas.RecordEntryOut:
    return schemas.RecordEntryOut(
        id=r.id,
        seq=r.seq,
        kind=r.kind,
        summary=r.summary,
        flagged=r.flagged,
        created_at=r.created_at,
        hash=r.hash,
        actor=maybe_person(r.actor),
    )


def program_out(p: Program, user_id: int | None = None) -> schemas.ProgramOut:
    return schemas.ProgramOut(
        id=p.id,
        title=p.title,
        summary=p.summary,
        description=p.description,
        topic=p.topic,
        format=p.format,
        location=p.location,
        starts_at=p.starts_at,
        ends_at=p.starts_at + timedelta(minutes=p.duration_minutes),
        duration_minutes=p.duration_minutes,
        price=p.price,
        capacity=p.capacity,
        spots_left=p.spots_left,
        host=p.host,
        practitioner=schemas.PractitionerOut(name=p.practitioner_name, title=p.practitioner_title, bio=p.practitioner_bio),
        is_published=p.is_published,
        my_tickets=sum(b.tickets for b in p.bookings if b.user_id == user_id),
    )


def booking_out(b: Booking) -> schemas.BookingOut:
    return schemas.BookingOut(
        id=b.id,
        code=b.code,
        tickets=b.tickets,
        amount=b.amount,
        payment_method=b.payment_method,
        created_at=b.created_at,
        program=program_out(b.program, b.user_id),
    )

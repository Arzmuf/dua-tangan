from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from ..deps import Ctx, get_ctx
from ..models import Event, Expense, Message, RecordEntry, utcnow
from ..schemas import ChildOut, HomeOut
from ..serializers import balance_out, event_out, expense_out, maybe_person

router = APIRouter(tags=["home"])


@router.get("/home", response_model=HomeOut)
def home(ctx: Ctx = Depends(get_ctx)):
    """Everything the home screen needs in one round trip."""
    db, family, me = ctx.db, ctx.family, ctx.user
    now = utcnow()

    events = [
        event_out(e, ctx)
        for e in db.scalars(
            select(Event)
            .where(
                Event.family_id == family.id,
                Event.status.in_(["pending", "confirmed"]),
                Event.starts_at >= now - timedelta(hours=24),
            )
            .order_by(Event.starts_at)
        )
    ]
    # Stays "next" until checked in or a few hours past, so the check-in button is easy to reach.
    next_handoff = next(
        (
            e
            for e in events
            if e.status == "confirmed"
            and (e.starts_at >= now - timedelta(hours=3) or e.actions.check_in)
        ),
        None,
    )
    pending_events = [e for e in events if e.actions.confirm or e.actions.respond_change]

    expenses = db.scalars(
        select(Expense)
        .where(Expense.family_id == family.id, Expense.status == "pending")
        .order_by(Expense.created_at)
    ).all()
    pending_expenses = [expense_out(x, ctx) for x in expenses if x.created_by_id != me.id]

    waiting_on_partner = (
        sum(1 for e in events if e.actions.cancel)
        + sum(1 for e in events if e.change and e.change.by.id == me.id)
        + sum(1 for x in expenses if x.created_by_id == me.id)
    )

    unread = db.scalar(
        select(func.count())
        .select_from(Message)
        .where(Message.family_id == family.id, Message.sender_id != me.id, Message.read_at.is_(None))
    )
    record_count = db.scalar(select(func.count()).select_from(RecordEntry).where(RecordEntry.family_id == family.id))

    return HomeOut(
        partner=maybe_person(ctx.partner),
        children=[ChildOut.model_validate(c) for c in family.children],
        next_handoff=next_handoff,
        pending_events=pending_events,
        pending_expenses=pending_expenses,
        waiting_on_partner=waiting_on_partner,
        unread_messages=unread or 0,
        balance=balance_out(ctx),
        record_count=record_count or 0,
    )

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select

from ..deps import Ctx, get_ctx
from ..fmt import kids, when
from ..models import Event, utcnow
from ..schemas import EventChangeIn, EventIn, EventOut
from ..serializers import event_actions, event_out
from ..services.record import log_event

router = APIRouter(prefix="/events", tags=["schedule"])

# Past handoffs stay visible in the calendar for a while.
HISTORY_WINDOW = timedelta(days=60)
# Two active handoffs closer together than this are treated as a clash.
CLASH_WINDOW = timedelta(minutes=60)


def aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def get_event(ctx: Ctx, event_id: int) -> Event:
    event = ctx.db.get(Event, event_id)
    if event is None or event.family_id != ctx.family.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Handoff not found.")
    return event


def require_future(dt: datetime) -> datetime:
    dt = aware(dt)
    if dt < utcnow() - timedelta(minutes=5):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Pick a time in the future.")
    return dt


def record(ctx: Ctx, summary: str) -> None:
    log_event(ctx.db, ctx.family.id, ctx.user, "schedule", summary)


def ensure_no_clash(ctx: Ctx, starts_at: datetime, ignore_id: int | None = None) -> None:
    """Refuse a slot already taken by an active handoff, or requested by a pending change."""

    def near(column):
        return and_(column > starts_at - CLASH_WINDOW, column < starts_at + CLASH_WINDOW)

    query = select(Event).where(
        Event.family_id == ctx.family.id,
        Event.status.in_(["pending", "confirmed"]),
        or_(near(Event.starts_at), near(Event.change_starts_at)),
    )
    if ignore_id is not None:
        query = query.where(Event.id != ignore_id)
    clash = ctx.db.scalars(query).first()
    if clash is not None:
        taken = clash.starts_at if abs(clash.starts_at - starts_at) < CLASH_WINDOW else clash.change_starts_at
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"There's already a handoff around then ({when(taken, ctx.family)}). Pick another time.",
        )


@router.get("", response_model=list[EventOut])
def list_events(ctx: Ctx = Depends(get_ctx)):
    rows = ctx.db.scalars(
        select(Event)
        .where(
            Event.family_id == ctx.family.id,
            Event.status.in_(["pending", "confirmed"]),
            Event.starts_at >= utcnow() - HISTORY_WINDOW,
        )
        .order_by(Event.starts_at)
    ).all()
    return [event_out(e, ctx) for e in rows]


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(data: EventIn, ctx: Ctx = Depends(get_ctx)):
    if ctx.partner is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Invite your co-parent before planning handoffs.")
    if data.to_parent_id not in (ctx.user.id, ctx.partner.id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose which parent the kids go to.")
    starts_at = require_future(data.starts_at)
    ensure_no_clash(ctx, starts_at)
    receiver = ctx.user if data.to_parent_id == ctx.user.id else ctx.partner
    event = Event(
        family_id=ctx.family.id,
        created_by_id=ctx.user.id,
        to_parent_id=receiver.id,
        starts_at=starts_at,
        location=data.location,
        note=data.note or None,
        status="pending",
    )
    ctx.db.add(event)
    record(
        ctx,
        f"Handoff proposed by {ctx.user.first_name} — {when(starts_at, ctx.family)}, "
        f"{kids(ctx.family.children)} to {receiver.first_name} at {data.location}",
    )
    ctx.db.commit()
    return event_out(event, ctx)


@router.post("/{event_id}/confirm", response_model=EventOut)
def confirm_event(event_id: int, ctx: Ctx = Depends(get_ctx)):
    event = get_event(ctx, event_id)
    if not event_actions(event, ctx).confirm:
        raise HTTPException(status.HTTP_409_CONFLICT, "This handoff can't be confirmed right now.")
    event.status = "confirmed"
    event.responded_at = utcnow()
    record(ctx, f"Handoff confirmed by {ctx.user.first_name} — {when(event.starts_at, ctx.family)}")
    ctx.db.commit()
    return event_out(event, ctx)


@router.post("/{event_id}/decline", response_model=EventOut)
def decline_event(event_id: int, ctx: Ctx = Depends(get_ctx)):
    event = get_event(ctx, event_id)
    if not event_actions(event, ctx).decline:
        raise HTTPException(status.HTTP_409_CONFLICT, "This handoff can't be declined right now.")
    event.status = "declined"
    event.responded_at = utcnow()
    record(ctx, f"Handoff declined by {ctx.user.first_name} — {when(event.starts_at, ctx.family)}")
    ctx.db.commit()
    return event_out(event, ctx)


@router.post("/{event_id}/cancel", response_model=EventOut)
def cancel_event(event_id: int, ctx: Ctx = Depends(get_ctx)):
    event = get_event(ctx, event_id)
    if not event_actions(event, ctx).cancel:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a pending proposal you made can be withdrawn.")
    event.status = "cancelled"
    record(ctx, f"Handoff proposal withdrawn by {ctx.user.first_name} — {when(event.starts_at, ctx.family)}")
    ctx.db.commit()
    return event_out(event, ctx)


@router.post("/{event_id}/change", response_model=EventOut)
def propose_change(event_id: int, data: EventChangeIn, ctx: Ctx = Depends(get_ctx)):
    event = get_event(ctx, event_id)
    if not event_actions(event, ctx).propose_change:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Changes can be proposed for upcoming confirmed handoffs without an open request."
        )
    new_start = require_future(data.starts_at)
    ensure_no_clash(ctx, new_start, ignore_id=event.id)
    new_location = data.location or event.location
    event.change_starts_at = new_start
    event.change_location = new_location
    event.change_reason = data.reason or None
    event.change_by_id = ctx.user.id
    event.change_at = utcnow()
    summary = (
        f"Change proposed by {ctx.user.first_name} — move {when(event.starts_at, ctx.family)} "
        f"to {when(new_start, ctx.family)}"
    )
    if new_location != event.location:
        summary += f" at {new_location}"
    if data.reason:
        summary += f". Reason: {data.reason}"
    record(ctx, summary)
    ctx.db.commit()
    return event_out(event, ctx)


def clear_change(event: Event) -> None:
    event.change_starts_at = None
    event.change_location = None
    event.change_reason = None
    event.change_by_id = None
    event.change_at = None


@router.post("/{event_id}/change/accept", response_model=EventOut)
def accept_change(event_id: int, ctx: Ctx = Depends(get_ctx)):
    event = get_event(ctx, event_id)
    if not event_actions(event, ctx).respond_change:
        raise HTTPException(status.HTTP_409_CONFLICT, "There's no change waiting for your answer.")
    ensure_no_clash(ctx, event.change_starts_at, ignore_id=event.id)
    old_start = event.starts_at
    event.starts_at = event.change_starts_at
    event.location = event.change_location or event.location
    event.checked_in_at = None
    event.checked_in_by_id = None
    clear_change(event)
    record(
        ctx,
        f"Change accepted by {ctx.user.first_name} — handoff moved from {when(old_start, ctx.family)} "
        f"to {when(event.starts_at, ctx.family)} at {event.location}",
    )
    ctx.db.commit()
    return event_out(event, ctx)


@router.post("/{event_id}/change/decline", response_model=EventOut)
def decline_change(event_id: int, ctx: Ctx = Depends(get_ctx)):
    event = get_event(ctx, event_id)
    if not event_actions(event, ctx).respond_change:
        raise HTTPException(status.HTTP_409_CONFLICT, "There's no change waiting for your answer.")
    clear_change(event)
    record(
        ctx,
        f"Change declined by {ctx.user.first_name} — handoff stays on {when(event.starts_at, ctx.family)}",
    )
    ctx.db.commit()
    return event_out(event, ctx)


@router.post("/{event_id}/check-in", response_model=EventOut)
def check_in(event_id: int, ctx: Ctx = Depends(get_ctx)):
    event = get_event(ctx, event_id)
    if not event_actions(event, ctx).check_in:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Check-in opens 3 hours before a confirmed handoff and closes a day after."
        )
    now = utcnow()
    event.checked_in_at = now
    event.checked_in_by_id = ctx.user.id
    record(
        ctx,
        f"Handoff checked in by {ctx.user.first_name} — {kids(ctx.family.children)} to "
        f"{event.to_parent.first_name} at {event.location}, {when(now, ctx.family)}",
    )
    ctx.db.commit()
    return event_out(event, ctx)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update

from ..deps import Ctx, get_ctx, get_current_user
from ..fmt import excerpt
from ..models import Message, User, utcnow
from ..schemas import MessageIn, MessageOut, ToneIn, ToneOut
from ..serializers import message_out
from ..services.record import log_event
from ..services.tone import check_tone

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("", response_model=list[MessageOut])
def list_messages(ctx: Ctx = Depends(get_ctx), limit: int = Query(200, ge=1, le=500)):
    rows = ctx.db.scalars(
        select(Message)
        .where(Message.family_id == ctx.family.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
    ).all()
    return [message_out(m, ctx) for m in reversed(rows)]


@router.post("", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(data: MessageIn, ctx: Ctx = Depends(get_ctx)):
    if ctx.partner is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Invite your co-parent to start messaging.")
    tone = check_tone(data.body)
    message = Message(
        family_id=ctx.family.id,
        sender_id=ctx.user.id,
        body=data.body,
        tone=tone.tone,
        is_urgent=data.is_urgent,
    )
    ctx.db.add(message)
    urgent = " (urgent)" if data.is_urgent else ""
    log_event(
        ctx.db,
        ctx.family.id,
        ctx.user,
        "message",
        f"Message sent{urgent} — {ctx.user.first_name} to {ctx.partner.first_name}: “{excerpt(data.body)}”",
        flagged=tone.tone == "heated",
    )
    ctx.db.commit()
    return message_out(message, ctx)


@router.post("/tone", response_model=ToneOut)
def tone_check(data: ToneIn, _: User = Depends(get_current_user)):
    result = check_tone(data.body)
    return ToneOut(tone=result.tone, flags=result.flags, tip=result.tip)


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(ctx: Ctx = Depends(get_ctx)):
    ctx.db.execute(
        update(Message)
        .where(
            Message.family_id == ctx.family.id,
            Message.sender_id != ctx.user.id,
            Message.read_at.is_(None),
        )
        .values(read_at=utcnow())
    )
    ctx.db.commit()

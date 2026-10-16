from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from ..deps import Ctx, get_ctx
from ..models import RecordEntry, utcnow
from ..schemas import RecordOut, ReportOut, VerificationOut
from ..serializers import entry_out, family_out
from ..services.record import verify_chain

router = APIRouter(prefix="/record", tags=["record"])


def verification(ctx: Ctx) -> VerificationOut:
    result = verify_chain(ctx.db, ctx.family.id)
    return VerificationOut(valid=result.valid, count=result.count, broken_seq=result.broken_seq, checked_at=utcnow())


@router.get("", response_model=RecordOut)
def read_record(
    ctx: Ctx = Depends(get_ctx),
    flagged: bool = False,
    kinds: str | None = Query(None, description="Comma-separated, e.g. message,expense"),
    limit: int = Query(300, ge=1, le=1000),
):
    in_family = RecordEntry.family_id == ctx.family.id
    query = select(RecordEntry).where(in_family)
    if kinds:
        query = query.where(RecordEntry.kind.in_(kinds.split(",")))
    if flagged:
        query = query.where(RecordEntry.flagged.is_(True))
    entries = ctx.db.scalars(query.order_by(RecordEntry.seq.desc()).limit(limit)).all()
    count = ctx.db.scalar(select(func.count()).select_from(RecordEntry).where(in_family))
    flagged_count = ctx.db.scalar(
        select(func.count()).select_from(RecordEntry).where(in_family, RecordEntry.flagged.is_(True))
    )
    kind_counts = ctx.db.execute(
        select(RecordEntry.kind, func.count()).where(in_family).group_by(RecordEntry.kind)
    ).all()
    return RecordOut(
        entries=[entry_out(e) for e in entries],
        count=count or 0,
        flagged_count=flagged_count or 0,
        kind_counts=dict(kind_counts),
        verification=verification(ctx),
    )


@router.get("/report", response_model=ReportOut)
def report(ctx: Ctx = Depends(get_ctx)):
    entries = ctx.db.scalars(
        select(RecordEntry).where(RecordEntry.family_id == ctx.family.id).order_by(RecordEntry.seq)
    ).all()
    family = family_out(ctx.family)
    return ReportOut(
        family_name=family.name,
        time_zone=family.time_zone,
        members=family.members,
        children=family.children,
        generated_at=utcnow(),
        verification=verification(ctx),
        entries=[entry_out(e) for e in entries],
    )

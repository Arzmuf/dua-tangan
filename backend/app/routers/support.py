from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from ..deps import Ctx, get_ctx
from ..models import Counsellor, SupportRequest
from ..schemas import CounsellorOut, SupportRequestIn, SupportRequestOut
from ..serializers import person
from ..services.record import log_event

router = APIRouter(prefix="/support", tags=["support"])

SESSION_LABELS = {
    "individual": "individual session",
    "co-parenting": "co-parenting session",
    "child": "child check-in",
}


def request_out(r: SupportRequest) -> SupportRequestOut:
    return SupportRequestOut(
        id=r.id,
        counsellor=CounsellorOut.model_validate(r.counsellor),
        session_type=r.session_type,
        preferred_time=r.preferred_time,
        note=r.note,
        status=r.status,
        created_at=r.created_at,
        requested_by=person(r.requested_by),
    )


@router.get("/counsellors", response_model=list[CounsellorOut])
def list_counsellors(ctx: Ctx = Depends(get_ctx)):
    return ctx.db.scalars(select(Counsellor).order_by(Counsellor.sort_order, Counsellor.id)).all()


@router.get("/requests", response_model=list[SupportRequestOut])
def list_requests(ctx: Ctx = Depends(get_ctx)):
    rows = ctx.db.scalars(
        select(SupportRequest)
        .where(SupportRequest.family_id == ctx.family.id)
        .order_by(SupportRequest.created_at.desc())
    ).all()
    return [request_out(r) for r in rows]


@router.post("/requests", response_model=SupportRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(data: SupportRequestIn, ctx: Ctx = Depends(get_ctx)):
    counsellor = ctx.db.get(Counsellor, data.counsellor_id)
    if counsellor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Counsellor not found.")
    request = SupportRequest(
        family_id=ctx.family.id,
        counsellor_id=counsellor.id,
        requested_by_id=ctx.user.id,
        session_type=data.session_type,
        preferred_time=data.preferred_time,
        note=data.note or None,
    )
    ctx.db.add(request)
    log_event(
        ctx.db,
        ctx.family.id,
        ctx.user,
        "support",
        f"Session requested by {ctx.user.first_name} — {SESSION_LABELS[data.session_type]} with "
        f"{counsellor.name}, {data.preferred_time}",
    )
    ctx.db.commit()
    return request_out(request)

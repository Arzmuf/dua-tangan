from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select

from ..deps import Ctx, get_ctx
from ..fmt import info_line
from ..models import InfoItem, utcnow
from ..schemas import InfoIn, InfoOut, InfoUpdateIn
from ..serializers import maybe_person
from ..services.record import log_event
from .family import get_child

router = APIRouter(tags=["child info"])


def info_out(item: InfoItem) -> InfoOut:
    return InfoOut(
        id=item.id,
        child_id=item.child_id,
        category=item.category,
        label=item.label,
        value=item.value,
        updated_at=item.updated_at,
        updated_by=maybe_person(item.updated_by),
    )


def get_item(ctx: Ctx, item_id: int) -> InfoItem:
    item = ctx.db.get(InfoItem, item_id)
    if item is None or item.family_id != ctx.family.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Detail not found.")
    return item


def record(ctx: Ctx, summary: str) -> None:
    log_event(ctx.db, ctx.family.id, ctx.user, "info", summary)


@router.get("/children/{child_id}/info", response_model=list[InfoOut])
def list_info(child_id: int, ctx: Ctx = Depends(get_ctx)):
    child = get_child(ctx, child_id)
    rows = ctx.db.scalars(
        select(InfoItem).where(InfoItem.child_id == child.id).order_by(InfoItem.created_at, InfoItem.id)
    ).all()
    return [info_out(i) for i in rows]


@router.post("/children/{child_id}/info", response_model=InfoOut, status_code=status.HTTP_201_CREATED)
def add_info(child_id: int, data: InfoIn, ctx: Ctx = Depends(get_ctx)):
    child = get_child(ctx, child_id)
    item = InfoItem(
        family_id=ctx.family.id,
        child_id=child.id,
        category=data.category,
        label=data.label,
        value=data.value,
        updated_by_id=ctx.user.id,
    )
    ctx.db.add(item)
    record(ctx, f"Info added by {ctx.user.first_name} — {info_line(item, child.name)}")
    ctx.db.commit()
    return info_out(item)


@router.patch("/info/{item_id}", response_model=InfoOut)
def update_info(item_id: int, data: InfoUpdateIn, ctx: Ctx = Depends(get_ctx)):
    item = get_item(ctx, item_id)
    child = get_child(ctx, item.child_id)
    if data.category is not None:
        item.category = data.category
    if data.label is not None:
        item.label = data.label
    if data.value is not None:
        item.value = data.value
    item.updated_by_id = ctx.user.id
    item.updated_at = utcnow()
    record(ctx, f"Info updated by {ctx.user.first_name} — {info_line(item, child.name)}")
    ctx.db.commit()
    return info_out(item)


@router.delete("/info/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_info(item_id: int, ctx: Ctx = Depends(get_ctx)):
    item = get_item(ctx, item_id)
    child = get_child(ctx, item.child_id)
    record(ctx, f"Info removed by {ctx.user.first_name} — {info_line(item, child.name, with_value=False)}")
    ctx.db.delete(item)
    ctx.db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

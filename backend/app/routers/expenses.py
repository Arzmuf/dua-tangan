from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select

from ..deps import Ctx, get_ctx
from ..fmt import local_today, rupiah
from ..models import Expense, utcnow
from ..schemas import ExpenseIn, ExpenseOut, ExpensesOut
from ..serializers import balance_out, expense_debtor, expense_out
from ..services.record import log_event

router = APIRouter(prefix="/expenses", tags=["expenses"])


def get_expense(ctx: Ctx, expense_id: int) -> Expense:
    expense = ctx.db.get(Expense, expense_id)
    if expense is None or expense.family_id != ctx.family.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found.")
    return expense


def record(ctx: Ctx, summary: str) -> None:
    log_event(ctx.db, ctx.family.id, ctx.user, "expense", summary)


@router.get("", response_model=ExpensesOut)
def list_expenses(ctx: Ctx = Depends(get_ctx)):
    rows = ctx.db.scalars(
        select(Expense)
        .where(Expense.family_id == ctx.family.id, Expense.status != "declined")
        .order_by(Expense.spent_on.desc(), Expense.id.desc())
    ).all()
    return ExpensesOut(balance=balance_out(ctx), expenses=[expense_out(x, ctx) for x in rows])


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(data: ExpenseIn, ctx: Ctx = Depends(get_ctx)):
    payer = next((m for m in ctx.family.members if m.id == data.paid_by_id), None)
    if payer is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose which parent paid.")
    expense = Expense(
        family_id=ctx.family.id,
        created_by_id=ctx.user.id,
        paid_by_id=payer.id,
        title=data.title,
        category=data.category,
        amount=data.amount,
        payer_share=data.payer_share,
        spent_on=data.spent_on or local_today(ctx.family),
        status="pending",
    )
    ctx.db.add(expense)
    record(
        ctx,
        f"Expense added by {ctx.user.first_name} — {data.title}, {rupiah(data.amount)}, paid by "
        f"{payer.first_name}, split {data.payer_share}/{100 - data.payer_share}",
    )
    ctx.db.commit()
    return expense_out(expense, ctx)


@router.post("/{expense_id}/approve", response_model=ExpenseOut)
def approve_expense(expense_id: int, ctx: Ctx = Depends(get_ctx)):
    expense = get_expense(ctx, expense_id)
    if not expense_out(expense, ctx).actions.approve:
        raise HTTPException(status.HTTP_409_CONFLICT, "This expense can't be approved right now.")
    now = utcnow()
    expense.responded_at = now
    if expense.owed_amount == 0:
        # Nothing is owed (the payer covers it all), so it is settled on approval.
        expense.status = "settled"
        expense.settled_at = now
        expense.settled_by_id = ctx.user.id
        record(ctx, f"Expense approved by {ctx.user.first_name} — {expense.title}, nothing owed")
    else:
        expense.status = "approved"
        record(
            ctx,
            f"Expense approved by {ctx.user.first_name} — {expense.title}, "
            f"{rupiah(expense.owed_amount)} owed to {expense.paid_by.first_name}",
        )
    ctx.db.commit()
    return expense_out(expense, ctx)


@router.post("/{expense_id}/decline", response_model=ExpenseOut)
def decline_expense(expense_id: int, ctx: Ctx = Depends(get_ctx)):
    expense = get_expense(ctx, expense_id)
    if not expense_out(expense, ctx).actions.decline:
        raise HTTPException(status.HTTP_409_CONFLICT, "This expense can't be declined right now.")
    expense.status = "declined"
    expense.responded_at = utcnow()
    record(ctx, f"Expense declined by {ctx.user.first_name} — {expense.title}, {rupiah(expense.amount)}")
    ctx.db.commit()
    return expense_out(expense, ctx)


@router.post("/{expense_id}/settle", response_model=ExpenseOut)
def settle_expense(expense_id: int, ctx: Ctx = Depends(get_ctx)):
    expense = get_expense(ctx, expense_id)
    if not expense_out(expense, ctx).actions.settle:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an approved expense can be settled.")
    debtor = expense_debtor(expense, ctx)
    expense.status = "settled"
    expense.settled_at = utcnow()
    expense.settled_by_id = ctx.user.id
    owed = rupiah(expense.owed_amount)
    if debtor is not None and ctx.user.id == debtor.id:
        record(ctx, f"{ctx.user.first_name} paid their share — {expense.title}, {owed}")
    else:
        record(ctx, f"{ctx.user.first_name} confirmed receiving {owed} — {expense.title}")
    ctx.db.commit()
    return expense_out(expense, ctx)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, ctx: Ctx = Depends(get_ctx)):
    expense = get_expense(ctx, expense_id)
    if not expense_out(expense, ctx).actions.delete:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a pending expense you added can be withdrawn.")
    record(ctx, f"Expense withdrawn by {ctx.user.first_name} — {expense.title}, {rupiah(expense.amount)}")
    ctx.db.delete(expense)
    ctx.db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

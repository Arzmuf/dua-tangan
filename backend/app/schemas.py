from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class In(BaseModel):
    """Base for request bodies: trims surrounding whitespace before length checks."""

    model_config = ConfigDict(str_strip_whitespace=True)


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- people & family -------------------------------------------------------------------------


class Person(Out):
    id: int
    name: str
    first_name: str


class UserOut(Out):
    id: int
    email: str
    full_name: str
    first_name: str


class ChildOut(Out):
    id: int
    name: str
    birth_date: date | None


class FamilyOut(Out):
    id: int
    name: str
    invite_code: str
    time_zone: str
    members: list[Person]
    children: list[ChildOut]


class MeOut(Out):
    user: UserOut
    family: FamilyOut | None


class AuthOut(Out):
    access_token: str
    token_type: str = "bearer"
    me: MeOut


class RegisterIn(In):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(In):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UpdateMeIn(In):
    full_name: str = Field(min_length=1, max_length=120)


class CreateFamilyIn(In):
    child_name: str = Field(min_length=1, max_length=80)
    child_birth_date: date | None = None
    time_zone: str | None = Field(default=None, max_length=64)


class JoinFamilyIn(In):
    invite_code: str = Field(min_length=4, max_length=12)


class ChildIn(In):
    name: str = Field(min_length=1, max_length=80)
    birth_date: date | None = None


# --- schedule --------------------------------------------------------------------------------


class EventActions(Out):
    confirm: bool
    decline: bool
    cancel: bool
    propose_change: bool
    respond_change: bool
    check_in: bool


class EventChange(Out):
    starts_at: datetime
    location: str
    reason: str | None
    by: Person
    at: datetime


class EventOut(Out):
    id: int
    starts_at: datetime
    location: str
    note: str | None
    status: Literal["pending", "confirmed", "declined", "cancelled"]
    to_parent: Person
    created_by: Person
    change: EventChange | None
    checked_in_at: datetime | None
    checked_in_by: Person | None
    actions: EventActions


class EventIn(In):
    starts_at: datetime
    to_parent_id: int
    location: str = Field(min_length=1, max_length=160)
    note: str | None = Field(default=None, max_length=500)


class EventChangeIn(In):
    starts_at: datetime
    location: str | None = Field(default=None, max_length=160)
    reason: str | None = Field(default=None, max_length=300)


# --- expenses --------------------------------------------------------------------------------

ExpenseCategory = Literal["school", "health", "activities", "clothing", "other"]


class ExpenseActions(Out):
    approve: bool
    decline: bool
    settle: bool
    delete: bool


class ExpenseOut(Out):
    id: int
    title: str
    category: ExpenseCategory
    amount: int
    payer_share: int
    owed_amount: int
    spent_on: date
    status: Literal["pending", "approved", "declined", "settled"]
    paid_by: Person
    created_by: Person
    debtor: Person | None
    settled_at: datetime | None
    created_at: datetime
    actions: ExpenseActions


class ExpenseIn(In):
    title: str = Field(min_length=1, max_length=120)
    category: ExpenseCategory = "other"
    amount: int = Field(gt=0, le=10_000_000_000)
    paid_by_id: int
    payer_share: int = Field(default=50, ge=0, le=100)
    spent_on: date | None = None


class BalanceOut(Out):
    # Positive: the co-parent owes you. Negative: you owe the co-parent.
    amount: int
    partner: Person | None


class ExpensesOut(Out):
    balance: BalanceOut
    expenses: list[ExpenseOut]


# --- messages --------------------------------------------------------------------------------


class MessageIn(In):
    body: str = Field(min_length=1, max_length=2000)
    is_urgent: bool = False


class ToneIn(In):
    body: str = Field(max_length=2000)


class ToneOut(Out):
    tone: Literal["calm", "heated"]
    flags: list[str]
    tip: str | None


class MessageOut(Out):
    id: int
    body: str
    tone: Literal["calm", "heated"]
    is_urgent: bool
    created_at: datetime
    read_at: datetime | None
    sender: Person
    mine: bool


# --- child info ------------------------------------------------------------------------------

InfoCategory = Literal["health", "school", "contacts", "other"]


class InfoIn(In):
    category: InfoCategory
    label: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=500)


class InfoUpdateIn(In):
    category: InfoCategory | None = None
    label: str | None = Field(default=None, min_length=1, max_length=80)
    value: str | None = Field(default=None, min_length=1, max_length=500)


class InfoOut(Out):
    id: int
    child_id: int
    category: InfoCategory
    label: str
    value: str
    updated_at: datetime
    updated_by: Person | None


# --- record ----------------------------------------------------------------------------------


class RecordEntryOut(Out):
    id: int
    seq: int
    kind: str
    summary: str
    flagged: bool
    created_at: datetime
    hash: str
    actor: Person | None


class VerificationOut(Out):
    valid: bool
    count: int
    broken_seq: int | None
    checked_at: datetime


class RecordOut(Out):
    entries: list[RecordEntryOut]
    count: int
    flagged_count: int
    verification: VerificationOut


class ReportOut(Out):
    family_name: str
    time_zone: str
    members: list[Person]
    children: list[ChildOut]
    generated_at: datetime
    verification: VerificationOut
    entries: list[RecordEntryOut]


# --- support ---------------------------------------------------------------------------------

SessionType = Literal["individual", "co-parenting", "child"]


class CounsellorOut(Out):
    id: int
    name: str
    title: str
    focus: str
    icon: str


class SupportRequestIn(In):
    counsellor_id: int
    session_type: SessionType
    preferred_time: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=500)


class SupportRequestOut(Out):
    id: int
    counsellor: CounsellorOut
    session_type: SessionType
    preferred_time: str
    note: str | None
    status: str
    created_at: datetime
    requested_by: Person


# --- home ------------------------------------------------------------------------------------


class HomeOut(Out):
    partner: Person | None
    children: list[ChildOut]
    next_handoff: EventOut | None
    pending_events: list[EventOut]
    pending_expenses: list[ExpenseOut]
    waiting_on_partner: int
    unread_messages: int
    balance: BalanceOut
    record_count: int

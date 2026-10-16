from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Family(Base):
    """A shared co-parenting space: up to two parents and their children."""

    __tablename__ = "families"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    invite_code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    time_zone: Mapped[str] = mapped_column(String(64), default="Asia/Jakarta")
    # Head of the tamper-evident record chain (see services/record.py).
    record_seq: Mapped[int] = mapped_column(Integer, default=0)
    record_head: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    members: Mapped[list[User]] = relationship(back_populates="family", order_by="User.id")
    children: Mapped[list[Child]] = relationship(back_populates="family", order_by="Child.id")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    family_id: Mapped[int | None] = mapped_column(
        ForeignKey("families.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    family: Mapped[Family | None] = relationship(back_populates="members")

    @property
    def first_name(self) -> str:
        parts = self.full_name.split()
        return parts[0] if parts else self.email


class Child(Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    birth_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    family: Mapped[Family] = relationship(back_populates="children")


class Event(Base):
    """A handoff: at `starts_at` the children go to `to_parent` at `location`.

    New handoffs start as `pending` until the other parent confirms. A confirmed handoff can carry
    one proposed change (the `change_*` columns) that the other parent accepts or declines.
    """

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    to_parent_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    location: Mapped[str] = mapped_column(String(160))
    note: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    change_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    change_location: Mapped[str | None] = mapped_column(String(160))
    change_reason: Mapped[str | None] = mapped_column(String(300))
    change_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    change_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_in_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])
    to_parent: Mapped[User] = relationship(foreign_keys=[to_parent_id])
    change_by: Mapped[User | None] = relationship(foreign_keys=[change_by_id])
    checked_in_by: Mapped[User | None] = relationship(foreign_keys=[checked_in_by_id])


class Expense(Base):
    """A shared cost. The parent who did not add it approves it; then the other parent's share is owed."""

    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    paid_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(24), default="other")
    amount: Mapped[int] = mapped_column(BigInteger)  # whole rupiah
    payer_share: Mapped[int] = mapped_column(Integer, default=50)  # % of the cost the payer covers
    spent_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    settled_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])
    paid_by: Mapped[User] = relationship(foreign_keys=[paid_by_id])
    settled_by: Mapped[User | None] = relationship(foreign_keys=[settled_by_id])

    @property
    def owed_amount(self) -> int:
        return self.amount * (100 - self.payer_share) // 100


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    tone: Mapped[str] = mapped_column(String(16), default="calm")
    is_urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    sender: Mapped[User] = relationship()


class InfoItem(Base):
    """One labelled fact about a child (allergies, school, an emergency contact...)."""

    __tablename__ = "info_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(24))
    label: Mapped[str] = mapped_column(String(80))
    value: Mapped[str] = mapped_column(String(500))
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    updated_by: Mapped[User | None] = relationship()


class RecordEntry(Base):
    """Append-only log. Each entry's hash covers the previous entry's hash, so edits are detectable."""

    __tablename__ = "record_entries"
    __table_args__ = (UniqueConstraint("family_id", "seq"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(24))
    summary: Mapped[str] = mapped_column(Text)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))

    actor: Mapped[User | None] = relationship()


class Counsellor(Base):
    __tablename__ = "counsellors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(120))
    focus: Mapped[str] = mapped_column(String(240))
    icon: Mapped[str] = mapped_column(String(16))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class SupportRequest(Base):
    __tablename__ = "support_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    counsellor_id: Mapped[int] = mapped_column(ForeignKey("counsellors.id"))
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    session_type: Mapped[str] = mapped_column(String(24))
    preferred_time: Mapped[str] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), default="requested")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    counsellor: Mapped[Counsellor] = relationship()
    requested_by: Mapped[User] = relationship()


class MessageTemplate(Base):
    """A parent's own quick message, listed after the built-in ones in its category."""

    __tablename__ = "message_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(24))
    body: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Program(Base):
    """A talk, webinar or workshop that parents can book: posted by an admin, run by a practitioner."""

    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    summary: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(String(24))
    format: Mapped[str] = mapped_column(String(16))  # "online" or "in-person"
    location: Mapped[str] = mapped_column(String(200))  # the venue, or how to join online
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=90)
    price: Mapped[int] = mapped_column(BigInteger, default=0)  # whole rupiah per ticket; 0 is free
    capacity: Mapped[int] = mapped_column(Integer, default=30)
    host: Mapped[str] = mapped_column(String(120), default="Sekala Jiwa")
    practitioner_name: Mapped[str] = mapped_column(String(120))
    practitioner_title: Mapped[str] = mapped_column(String(160))
    practitioner_bio: Mapped[str] = mapped_column(String(1000))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    bookings: Mapped[list[Booking]] = relationship(back_populates="program")

    @property
    def tickets_sold(self) -> int:
        return sum(b.tickets for b in self.bookings)

    @property
    def spots_left(self) -> int:
        return max(self.capacity - self.tickets_sold, 0)


class Booking(Base):
    """A booked place on a program. Payment is mocked for now, and every booking is final."""

    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    code: Mapped[str] = mapped_column(String(12), unique=True)
    tickets: Mapped[int] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(BigInteger)  # total paid, whole rupiah
    payment_method: Mapped[str] = mapped_column(String(24))
    payment_ref: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    program: Mapped[Program] = relationship(back_populates="bookings")
    user: Mapped[User] = relationship()

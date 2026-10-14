"""The shared record: an append-only, hash-chained log per family.

Each entry stores the previous entry's hash and a SHA-256 over its own fields plus that previous
hash. Editing or deleting any row breaks every hash after it, which `verify_chain` detects.
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Family, RecordEntry, User, utcnow

GENESIS = "0" * 64


def _digest(
    prev_hash: str,
    family_id: int,
    seq: int,
    created_at: datetime,
    actor_id: int | None,
    kind: str,
    summary: str,
    flagged: bool,
) -> str:
    raw = "|".join(
        [
            prev_hash,
            str(family_id),
            str(seq),
            created_at.astimezone(timezone.utc).isoformat(),
            str(actor_id or ""),
            kind,
            summary,
            "1" if flagged else "0",
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def log_event(
    db: Session,
    family_id: int,
    actor: User | None,
    kind: str,
    summary: str,
    flagged: bool = False,
    at: datetime | None = None,
) -> RecordEntry:
    """Append an entry inside the caller's transaction. The family row lock serialises writers."""
    db.flush()
    family = db.execute(
        select(Family)
        .where(Family.id == family_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one()
    seq = family.record_seq + 1
    prev = family.record_head or GENESIS
    created_at = at or utcnow()
    actor_id = actor.id if actor else None
    entry = RecordEntry(
        family_id=family_id,
        seq=seq,
        actor_id=actor_id,
        kind=kind,
        summary=summary,
        flagged=flagged,
        created_at=created_at,
        prev_hash=prev,
        hash=_digest(prev, family_id, seq, created_at, actor_id, kind, summary, flagged),
    )
    family.record_seq = seq
    family.record_head = entry.hash
    db.add(entry)
    return entry


@dataclass
class Verification:
    valid: bool
    count: int
    broken_seq: int | None


def verify_chain(db: Session, family_id: int) -> Verification:
    entries = db.scalars(
        select(RecordEntry).where(RecordEntry.family_id == family_id).order_by(RecordEntry.seq)
    ).all()
    prev = GENESIS
    for expected_seq, e in enumerate(entries, start=1):
        digest = _digest(prev, e.family_id, e.seq, e.created_at, e.actor_id, e.kind, e.summary, e.flagged)
        if e.seq != expected_seq or e.prev_hash != prev or e.hash != digest:
            return Verification(valid=False, count=len(entries), broken_seq=e.seq)
        prev = e.hash
    head = db.scalar(select(Family.record_head).where(Family.id == family_id))
    if entries and head != prev:
        return Verification(valid=False, count=len(entries), broken_seq=entries[-1].seq)
    return Verification(valid=True, count=len(entries), broken_seq=None)

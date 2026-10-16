"""Demo data: Nadia and Reza co-parenting Kirana.

All dates are relative to "now", so the demo always looks current. Rebuild it any time with:

    python -m app.seed --reset
"""

import argparse
import os
from collections.abc import Callable
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal
from .fmt import DEFAULT_TZ, excerpt, info_line, rupiah, when
from .migrate import drop_everything, migrate
from .models import Child, Counsellor, Event, Expense, Family, InfoItem, Message, User, utcnow
from .security import hash_password
from .services.record import log_event
from .services.tone import check_tone

DEMO_PASSWORD = "demo1234"


def demo_time_zone() -> str:
    """DEMO_TIME_ZONE, else this machine's zone (so demo times match the clock where it runs), else Jakarta."""
    candidates = [settings.demo_time_zone or "", os.environ.get("TZ", "")]
    try:
        target = os.path.realpath("/etc/localtime")
        if "zoneinfo/" in target:
            candidates.append(target.split("zoneinfo/", 1)[1])
    except OSError:
        pass
    for name in candidates:
        name = name.lstrip(":")
        if not name:
            continue
        try:
            ZoneInfo(name)
            return name
        except Exception:
            continue
    return DEFAULT_TZ

COUNSELLORS = [
    {
        "name": "Rini Hartono, M.Psi.",
        "title": "Child & family psychologist",
        "focus": "Helps children feel secure while adjusting to two homes",
        "icon": "🧸",
        "sort_order": 1,
    },
    {
        "name": "Dr. Amelia Wijaya, Psikolog",
        "title": "Co-parenting counsellor",
        "focus": "Calmer communication and fewer conflicts between parents",
        "icon": "🤝",
        "sort_order": 2,
    },
    {
        "name": "Yusuf Pratama, M.Psi.",
        "title": "Individual therapist",
        "focus": "Support for you while you process the separation",
        "icon": "🌿",
        "sort_order": 3,
    },
]


def ensure_counsellors(db: Session) -> None:
    if not db.scalar(select(func.count()).select_from(Counsellor)):
        db.add_all(Counsellor(**c) for c in COUNSELLORS)
        db.commit()


def seed_demo_if_empty(db: Session) -> None:
    if not db.scalar(select(func.count()).select_from(User)):
        seed_demo(db)


def seed_demo(db: Session) -> None:
    tz_name = demo_time_zone()
    tz = ZoneInfo(tz_name)
    now = utcnow()
    today = now.astimezone(tz).date()

    def day_at(offset: int, hour: int, minute: int = 0) -> datetime:
        return datetime.combine(today + timedelta(days=offset), time(hour, minute), tzinfo=tz)

    # Handoffs happen on weekends: offsets below are counted from the coming Saturday.
    sat = (5 - today.weekday()) % 7 or 7

    def ago(days: float = 0, hours: float = 0, minutes: float = 0) -> datetime:
        return now - timedelta(days=days, hours=hours, minutes=minutes)

    nadia = User(
        email="nadia@duatangan.app",
        full_name="Nadia Wulandari",
        password_hash=hash_password(DEMO_PASSWORD),
        created_at=ago(days=41),
    )
    reza = User(
        email="reza@duatangan.app",
        full_name="Reza Prasetyo",
        password_hash=hash_password(DEMO_PASSWORD),
        created_at=ago(days=41),
    )
    family = Family(name="Kirana's family", invite_code="KIRANA", time_zone=tz_name, created_at=ago(days=40))
    kirana = Child(name="Kirana", birth_date=date(2019, 3, 12))
    family.children.append(kirana)
    db.add_all([nadia, reza, family])
    db.flush()

    # Every step mutates data and logs it. Steps run in time order so the hash chain is chronological.
    steps: list[tuple[datetime, Callable[[], None]]] = []
    objs: dict[str, Event | Expense] = {}

    def log(actor: User, kind: str, summary: str, at: datetime, flagged: bool = False) -> None:
        log_event(db, family.id, actor, kind, summary, flagged=flagged, at=at)

    def other(user: User) -> User:
        return reza if user is nadia else nadia

    def step(at: datetime):
        def register(fn: Callable[[], None]) -> Callable[[], None]:
            steps.append((at, fn))
            return fn

        return register

    # --- family ---------------------------------------------------------------------------------
    @step(ago(days=40))
    def _():
        nadia.family = family
        db.flush()
        log(nadia, "family", "Family space created by Nadia for Kirana", ago(days=40))

    @step(ago(days=40) + timedelta(hours=2))
    def _():
        reza.family = family
        db.flush()
        log(reza, "family", "Reza joined the family space", ago(days=40) + timedelta(hours=2))

    # --- child info -------------------------------------------------------------------------------
    info = [
        (nadia, "health", "Pediatrician", "dr. Amanda Sutedjo, Brawijaya Clinic"),
        (nadia, "health", "Allergies", "Peanuts — antihistamine is in her school bag"),
        (nadia, "health", "Blood type", "O+"),
        (reza, "health", "Insurance", "Prudential — policy no. 88213456"),
        (reza, "school", "School", "SD Cikini Terpadu, Grade 1B"),
        (reza, "school", "Homeroom teacher", "Bu Ratna"),
        (nadia, "school", "Pickup list", "Nadia, Reza, Oma Sri"),
        (nadia, "contacts", "Oma Sri (grandmother)", "0812-0000-1187"),
        (reza, "contacts", "Dr. Amanda (pediatrician)", "021-0000-4420"),
    ]
    for i, (who, category, label, value) in enumerate(info):
        at = ago(days=38) + timedelta(minutes=9 * i)

        def add_info(who=who, category=category, label=label, value=value, at=at):
            item = InfoItem(
                family_id=family.id,
                child_id=kirana.id,
                category=category,
                label=label,
                value=value,
                updated_by_id=who.id,
                created_at=at,
                updated_at=at,
            )
            db.add(item)
            log(who, "info", f"Info added by {who.first_name} — {info_line(item, kirana.name)}", at)

        steps.append((at, add_info))

    # --- expenses ---------------------------------------------------------------------------------
    def add_expense(key, by, paid_by, title, category, amount, spent_days_ago, at, payer_share=50):
        def run():
            x = Expense(
                family_id=family.id,
                created_by_id=by.id,
                paid_by_id=paid_by.id,
                title=title,
                category=category,
                amount=amount,
                payer_share=payer_share,
                spent_on=today - timedelta(days=spent_days_ago),
                status="pending",
                created_at=at,
            )
            db.add(x)
            objs[key] = x
            log(
                by,
                "expense",
                f"Expense added by {by.first_name} — {title}, {rupiah(amount)}, paid by {paid_by.first_name}, "
                f"split {payer_share}/{100 - payer_share}",
                at,
            )

        steps.append((at, run))

    def approve_expense(key, by, at):
        def run():
            x = objs[key]
            x.status = "approved"
            x.responded_at = at
            log(
                by,
                "expense",
                f"Expense approved by {by.first_name} — {x.title}, {rupiah(x.owed_amount)} owed to "
                f"{other(by).first_name}",
                at,
            )

        steps.append((at, run))

    def settle_expense(key, by, at):
        def run():
            x = objs[key]
            x.status = "settled"
            x.settled_at = at
            x.settled_by_id = by.id
            log(by, "expense", f"{by.first_name} paid their share — {x.title}, {rupiah(x.owed_amount)}", at)

        steps.append((at, run))

    add_expense("doctor", nadia, nadia, "Doctor visit", "health", 210_000, 30, ago(days=30))
    approve_expense("doctor", reza, ago(days=29))
    settle_expense("doctor", reza, ago(days=27))

    add_expense("swim", nadia, nadia, "Swimming lessons", "activities", 620_000, 21, ago(days=20))
    approve_expense("swim", reza, ago(days=19))
    settle_expense("swim", reza, ago(days=12))

    add_expense("books", nadia, nadia, "Books & stationery", "school", 300_000, 6, ago(days=6))
    approve_expense("books", reza, ago(days=5))

    add_expense("shoes", reza, reza, "School shoes", "clothing", 340_000, 2, ago(days=2))

    # --- schedule ---------------------------------------------------------------------------------
    gambir = "Gambir Station, drop-off point B"
    lobby = "Nadia's apartment lobby"

    def propose(key, by, starts_at, to, location, at):
        def run():
            e = Event(
                family_id=family.id,
                created_by_id=by.id,
                to_parent_id=to.id,
                starts_at=starts_at,
                location=location,
                status="pending",
                created_at=at,
            )
            db.add(e)
            objs[key] = e
            log(
                by,
                "schedule",
                f"Handoff proposed by {by.first_name} — {when(starts_at, family)}, Kirana to {to.first_name} "
                f"at {location}",
                at,
            )

        steps.append((at, run))

    def confirm(key, by, at):
        def run():
            e = objs[key]
            e.status = "confirmed"
            e.responded_at = at
            log(by, "schedule", f"Handoff confirmed by {by.first_name} — {when(e.starts_at, family)}", at)

        steps.append((at, run))

    def propose_change(key, by, new_start, reason, at):
        def run():
            e = objs[key]
            e.change_starts_at = new_start
            e.change_location = e.location
            e.change_reason = reason
            e.change_by_id = by.id
            e.change_at = at
            log(
                by,
                "schedule",
                f"Change proposed by {by.first_name} — move {when(e.starts_at, family)} to "
                f"{when(new_start, family)}. Reason: {reason}",
                at,
            )

        steps.append((at, run))

    def check_in(key, by, at):
        def run():
            e = objs[key]
            e.checked_in_at = at
            e.checked_in_by_id = by.id
            log(
                by,
                "schedule",
                f"Handoff checked in by {by.first_name} — Kirana to {e.to_parent.first_name} at {e.location}, "
                f"{when(at, family)}",
                at,
            )

        steps.append((at, run))

    past_sunday = day_at(sat - 13, 17)
    propose("past", nadia, past_sunday, nadia, lobby, past_sunday - timedelta(days=7))
    confirm("past", reza, past_sunday - timedelta(days=6, hours=20))
    check_in("past", nadia, past_sunday + timedelta(minutes=6))

    propose("sat", reza, day_at(sat, 9), reza, gambir, ago(days=5, hours=3))
    confirm("sat", nadia, ago(days=5))
    propose("sun", reza, day_at(sat + 1, 17), nadia, lobby, ago(days=5, hours=3) + timedelta(minutes=2))
    confirm("sun", nadia, ago(days=5) + timedelta(minutes=1))

    propose("swap", reza, day_at(sat + 7, 9), reza, gambir, ago(days=4))
    confirm("swap", nadia, ago(days=3, hours=22))
    propose_change(
        "swap",
        reza,
        day_at(sat + 14, 9),
        "My cousin's wedding is that Saturday — can we swap weekends?",
        ago(hours=3),
    )

    propose("mall", reza, day_at(sat + 21, 10), reza, "Grand Indonesia, main lobby", ago(hours=2))

    # --- messages ---------------------------------------------------------------------------------
    def message(by, body, at, read_at=None):
        def run():
            tone = check_tone(body)
            db.add(
                Message(
                    family_id=family.id,
                    sender_id=by.id,
                    body=body,
                    tone=tone.tone,
                    created_at=at,
                    read_at=read_at,
                )
            )
            log(
                by,
                "message",
                f"Message sent — {by.first_name} to {other(by).first_name}: “{excerpt(body)}”",
                at,
                flagged=tone.tone == "heated",
            )

        steps.append((at, run))

    message(
        reza,
        "Kirana had a slight fever this morning, gave her paracetamol at 8am. Seems better now.",
        day_at(-1, 8, 41),
        read_at=day_at(-1, 8, 50),
    )
    message(
        nadia,
        "Thanks for letting me know. I'll check in with her teacher too.",
        day_at(-1, 8, 52),
        read_at=day_at(-1, 9, 5),
    )
    message(
        reza,
        "Can we talk about the shoes expense? You always leave this until the last minute.",
        day_at(-1, 21, 15),
        read_at=day_at(-1, 21, 40),
    )
    message(
        reza,
        "I sent a request to swap next weekend — my cousin's wedding is that Saturday. Let me know 🙏",
        ago(minutes=40),
    )

    for _, run in sorted(steps, key=lambda s: s[0]):
        run()
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Dua Tangan demo data.")
    parser.add_argument("--reset", action="store_true", help="drop every table first (deletes all data)")
    args = parser.parse_args()

    if args.reset:
        drop_everything()
    migrate()
    with SessionLocal() as db:
        ensure_counsellors(db)
        if db.scalar(select(func.count()).select_from(User)):
            print("Database already has users; run with --reset to rebuild the demo.")
            return
        seed_demo(db)
    print(f"Demo ready. Sign in as nadia@duatangan.app or reza@duatangan.app (password: {DEMO_PASSWORD}).")


if __name__ == "__main__":
    main()

"""Human-readable text for record summaries. Summaries are frozen into the hash chain, so they are
written once, in the family's time zone."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from .models import Child, Family, InfoItem

DEFAULT_TZ = "Asia/Jakarta"

INFO_CATEGORY_LABELS = {"health": "Health", "school": "School", "contacts": "Contacts", "other": "Other"}


def zone(family: Family) -> ZoneInfo:
    try:
        return ZoneInfo(family.time_zone or DEFAULT_TZ)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


def local_today(family: Family) -> date:
    return datetime.now(zone(family)).date()


def when(dt: datetime, family: Family) -> str:
    local = dt.astimezone(zone(family))
    return f"{local:%a} {local.day} {local:%b}, {local:%H:%M}"


def rupiah(amount: int) -> str:
    return "Rp" + f"{amount:,}".replace(",", ".")


def kids(children: list[Child]) -> str:
    names = [c.name for c in children]
    if not names:
        return "The kids"
    if len(names) == 1:
        return names[0]
    return ", ".join(names[:-1]) + " & " + names[-1]


def excerpt(text: str, limit: int = 80) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[: limit - 1].rstrip() + "…"


def info_line(item: InfoItem, child_name: str, with_value: bool = True) -> str:
    line = f"{child_name} · {INFO_CATEGORY_LABELS[item.category]}: {item.label}"
    return f"{line} — {excerpt(item.value, 60)}" if with_value else line

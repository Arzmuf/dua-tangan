"""A small, rule-based tone check (English + Indonesian).

It flags blame absolutes ("you always"), insults and shouting so the sender can reconsider before a
message lands in the permanent record. It is a heuristic, not a classifier.
"""

import re
from dataclasses import dataclass, field

ABSOLUTES = [
    r"\byou(?:'re| are)?\s+(?:always|never)\b",
    r"\b(?:kamu|kau|lu|lo|elo|anda)\s+(?:selalu|tidak pernah|gak pernah|nggak pernah|ga pernah|enggak pernah)\b",
]

HARSH_WORDS = [
    # English
    "unbelievable", "ridiculous", "can't believe", "cant believe", "sick of", "fed up", "your fault",
    "irresponsible", "useless", "pathetic", "stupid", "idiot", "liar", "shut up", "as usual",
    "typical of you", "i hate", "selfish", "disgusting",
    # Indonesian
    "keterlaluan", "bodoh", "goblok", "tolol", "pembohong", "egois", "muak", "salahmu", "salah kamu",
    "dasar kamu", "capek sama kamu",
]

TIP_ABSOLUTE = "Words like “always” and “never” can feel like blame. Try describing this one situation."
TIP_HARSH = "Try describing what you need and suggest a next step, e.g. “Could we settle this by Friday?”"
TIP_SHOUT = "All caps and “?!” or “!!!” can read as shouting."


@dataclass
class ToneResult:
    tone: str = "calm"
    flags: list[str] = field(default_factory=list)
    tip: str | None = None


def _match_phrase(text: str, phrase: str) -> bool:
    return re.search(r"(?<![\w'])" + re.escape(phrase) + r"(?![\w'])", text) is not None


def check_tone(body: str) -> ToneResult:
    text = body.lower()
    flags: list[str] = []
    tips: list[str] = []

    for pattern in ABSOLUTES:
        for m in re.finditer(pattern, text):
            flags.append(m.group(0))
    if flags:
        tips.append(TIP_ABSOLUTE)

    harsh = [w for w in HARSH_WORDS if _match_phrase(text, w)]
    if harsh:
        flags.extend(harsh)
        tips.append(TIP_HARSH)

    shouted = re.findall(r"\b[A-Z]{3,}\b", body)
    if len(shouted) >= 2 or re.search(r"!{3,}|\?!|!\?", body):
        flags.append("shouting")
        tips.append(TIP_SHOUT)

    if not flags:
        return ToneResult()
    # Keep order, drop duplicates.
    unique = list(dict.fromkeys(flags))
    return ToneResult(tone="heated", flags=unique, tip=tips[0])

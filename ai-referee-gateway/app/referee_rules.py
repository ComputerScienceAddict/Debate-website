import re
from app.schemas import RefereeEvent


TOXIC_PATTERNS = [
    r"\bidiot\b",
    r"\bstupid\b",
    r"\bmoron\b",
    r"\bdumbass\b",
    r"\bshut up\b",
    r"\byou people\b",
]

STRAWMAN_PATTERNS = [
    r"\bso you're saying\b",
    r"\bso you think\b",
    r"\byour argument is basically\b",
]

EVIDENCE_CLAIM_PATTERNS = [
    r"\bstudies show\b",
    r"\bresearch proves\b",
    r"\beveryone knows\b",
    r"\bit is proven\b",
    r"\bthe data says\b",
]

ABSOLUTE_CLAIM_PATTERNS = [
    r"\balways\b",
    r"\bnever\b",
    r"\bevery single\b",
    r"\ball of them\b",
    r"\bnone of them\b",
]


def _contains_any(patterns: list[str], text: str) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def analyze_live_rules(text: str) -> list[RefereeEvent]:
    cleaned = text.strip()
    events: list[RefereeEvent] = []

    if _contains_any(TOXIC_PATTERNS, cleaned):
        events.append(
            RefereeEvent(
                type="civility_warning",
                severity="medium",
                message="Attack the argument, not the person.",
                points_delta=-3,
                quote=cleaned[:220],
            )
        )

    if _contains_any(STRAWMAN_PATTERNS, cleaned):
        events.append(
            RefereeEvent(
                type="possible_strawman",
                severity="low",
                message="Make sure you are accurately representing the opponent's actual position.",
                points_delta=-1,
                quote=cleaned[:220],
            )
        )

    if _contains_any(EVIDENCE_CLAIM_PATTERNS, cleaned):
        events.append(
            RefereeEvent(
                type="evidence_needed",
                severity="info",
                message="A factual claim was made. Strong debates should include a source, example, or mechanism.",
                points_delta=0,
                quote=cleaned[:220],
            )
        )

    if _contains_any(ABSOLUTE_CLAIM_PATTERNS, cleaned) and len(cleaned.split()) > 8:
        events.append(
            RefereeEvent(
                type="absolute_claim_warning",
                severity="low",
                message="Absolute claims are risky. Add nuance or evidence.",
                points_delta=-1,
                quote=cleaned[:220],
            )
        )

    if len(cleaned.split()) < 4:
        events.append(
            RefereeEvent(
                type="low_substance",
                severity="info",
                message="This response is very short. Add reasoning or evidence.",
                points_delta=0,
                quote=cleaned[:220],
            )
        )

    return events

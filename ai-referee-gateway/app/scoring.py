from typing import Any


WEIGHTS = {
    "logic": 0.25,
    "evidence": 0.25,
    "clarity": 0.20,
    "rebuttal": 0.20,
    "civility": 0.10,
}


def clamp_score(value: Any) -> int:
    try:
        score = int(round(float(value)))
    except Exception:
        score = 0

    return max(0, min(100, score))


def recompute_total(side: dict[str, Any]) -> int:
    total = 0.0

    for key, weight in WEIGHTS.items():
        side[key] = clamp_score(side.get(key, 0))
        total += side[key] * weight

    side["total"] = clamp_score(total)
    return side["total"]


def normalize_result(result: dict[str, Any]) -> dict[str, Any]:
    result.setdefault("winner_recommendation", "tie")
    result.setdefault("confidence", 0.4)
    result.setdefault("affirmative", {})
    result.setdefault("negative", {})
    result.setdefault("summary", "")
    result.setdefault("key_moments", [])
    result.setdefault("fallacies", [])
    result.setdefault("improvement_tips", {})
    result.setdefault("referee_notes", [])

    recompute_total(result["affirmative"])
    recompute_total(result["negative"])

    try:
        result["confidence"] = float(result["confidence"])
    except Exception:
        result["confidence"] = 0.4

    result["confidence"] = max(0.0, min(1.0, result["confidence"]))

    aff_total = result["affirmative"]["total"]
    neg_total = result["negative"]["total"]

    if abs(aff_total - neg_total) <= 2:
        result["winner_recommendation"] = "tie"
    elif aff_total > neg_total:
        result["winner_recommendation"] = "affirmative"
    else:
        result["winner_recommendation"] = "negative"

    result["improvement_tips"].setdefault("affirmative", "Add clearer structure, stronger evidence, and more direct rebuttals.")
    result["improvement_tips"].setdefault("negative", "Add clearer structure, stronger evidence, and more direct rebuttals.")

    return result

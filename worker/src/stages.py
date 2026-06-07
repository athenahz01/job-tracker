from __future__ import annotations

STAGES = [
    "Saved",
    "Applied",
    "Assessment",
    "Phone Screen",
    "Interview",
    "Final",
    "Offer",
    "Rejected",
    "Ghosted",
]

STAGE_RANK = {
    "Saved": 0,
    "Applied": 10,
    "Assessment": 20,
    "Phone Screen": 30,
    "Interview": 40,
    "Final": 50,
    "Offer": 60,
}

ACTIVE_STAGES = set(STAGE_RANK)


def resolve_forward_stage(current: str, detected: str | None) -> str:
    if current in {"Offer", "Rejected"}:
        return current

    if detected == "Rejected":
        return "Rejected"

    detected_rank = STAGE_RANK.get(detected or "")
    if detected_rank is None:
        return current

    if current == "Ghosted":
        return detected or current

    current_rank = STAGE_RANK.get(current)
    if current_rank is None:
        return current

    return detected if detected_rank > current_rank else current

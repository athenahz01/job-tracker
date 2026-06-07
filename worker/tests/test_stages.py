from __future__ import annotations

from src.stages import resolve_forward_stage


def test_forward_move() -> None:
    assert resolve_forward_stage("Applied", "Interview") == "Interview"


def test_no_regression() -> None:
    assert resolve_forward_stage("Interview", "Assessment") == "Interview"


def test_rejected_from_active_stage() -> None:
    assert resolve_forward_stage("Final", "Rejected") == "Rejected"


def test_offer_and_rejected_are_terminal() -> None:
    assert resolve_forward_stage("Offer", "Rejected") == "Offer"
    assert resolve_forward_stage("Rejected", "Interview") == "Rejected"


def test_ghosted_reactivation() -> None:
    assert resolve_forward_stage("Ghosted", "Phone Screen") == "Phone Screen"

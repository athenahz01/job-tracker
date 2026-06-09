from __future__ import annotations

import sys
from types import ModuleType

import src.ingest as ingest

fake_supabase_module = ModuleType("supabase")
fake_supabase_module.Client = object
fake_supabase_module.create_client = lambda url, key: object()
sys.modules.setdefault("supabase", fake_supabase_module)

import src.main as main

from .helpers import make_config
from .test_ingest import FakeSupabase, base_message


def test_poll_does_not_advance_sync_state_on_classification_failure(monkeypatch) -> None:
    supabase = FakeSupabase()
    original_last_poll_at = supabase.tables["sync_state"][0]["last_poll_at"]
    _patch_gmail(monkeypatch)
    monkeypatch.setattr(ingest, "classify_email", lambda message, config: None)

    results = main.poll_once(make_config(), supabase=supabase)

    assert [result.action for result in results] == ["failed"]
    assert results[0].error == "classification_failed"
    assert supabase.tables["sync_state"][0]["last_poll_at"] == original_last_poll_at
    assert supabase.tables["email_events"] == []


def test_poll_advances_sync_state_after_genuine_other(monkeypatch) -> None:
    supabase = FakeSupabase()
    original_last_poll_at = supabase.tables["sync_state"][0]["last_poll_at"]
    _patch_gmail(monkeypatch)
    monkeypatch.setattr(
        ingest,
        "classify_email",
        lambda message, config: {
            "category": "other",
            "company": None,
            "role": None,
            "stage": None,
            "confidence": 0.96,
            "summary": "Personal mail",
        },
    )

    results = main.poll_once(make_config(), supabase=supabase)

    assert [result.action for result in results] == ["ignored_other"]
    assert supabase.tables["sync_state"][0]["last_poll_at"] != original_last_poll_at
    assert supabase.tables["email_events"] == []


def _patch_gmail(monkeypatch) -> None:
    monkeypatch.setattr(main, "build_gmail_service", lambda config: object())
    monkeypatch.setattr(
        main,
        "list_candidate_message_ids",
        lambda service, config, last_poll_at: ["gmail-1"],
    )
    monkeypatch.setattr(
        main,
        "fetch_message",
        lambda service, config, message_id: base_message(gmail_message_id=message_id),
    )

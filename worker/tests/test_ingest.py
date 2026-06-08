from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import src.ingest as ingest

from .helpers import make_config


class UniqueViolation(Exception):
    code = "23505"


class FakeSupabase:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {
            "email_events": [],
            "job_postings": [],
            "applications": [
                {
                    "id": "app-1",
                    "company": "Acme",
                    "normalized_company": "acme",
                    "company_domain": "acme.com",
                    "kind": "application",
                    "stage": "Applied",
                    "stage_locked": False,
                    "role": None,
                    "salary": None,
                    "location": None,
                    "tags": [],
                    "last_activity": "2026-01-01T00:00:00+00:00",
                    "merged_into_id": None,
                }
            ],
        }

    def table(self, name: str) -> "FakeQuery":
        return FakeQuery(self, name)


class FakeQuery:
    def __init__(self, client: FakeSupabase, table: str) -> None:
        self.client = client
        self.table = table
        self.operation = "select"
        self.payload: dict[str, Any] | None = None
        self.filters: list[tuple[str, str, Any]] = []
        self.limit_count: int | None = None
        self.order_column: str | None = None
        self.order_desc = False

    def select(self, *_: object) -> "FakeQuery":
        self.operation = "select"
        return self

    def insert(self, payload: dict[str, Any]) -> "FakeQuery":
        self.operation = "insert"
        self.payload = dict(payload)
        return self

    def update(self, payload: dict[str, Any]) -> "FakeQuery":
        self.operation = "update"
        self.payload = dict(payload)
        return self

    def eq(self, column: str, value: Any) -> "FakeQuery":
        self.filters.append(("eq", column, value))
        return self

    def is_(self, column: str, value: Any) -> "FakeQuery":
        self.filters.append(("is", column, value))
        return self

    def in_(self, column: str, value: list[Any]) -> "FakeQuery":
        self.filters.append(("in", column, value))
        return self

    def lt(self, column: str, value: Any) -> "FakeQuery":
        self.filters.append(("lt", column, value))
        return self

    def gte(self, column: str, value: Any) -> "FakeQuery":
        self.filters.append(("gte", column, value))
        return self

    def limit(self, count: int) -> "FakeQuery":
        self.limit_count = count
        return self

    def order(self, column: str, desc: bool = False) -> "FakeQuery":
        self.order_column = column
        self.order_desc = desc
        return self

    def execute(self) -> SimpleNamespace:
        rows = self.client.tables[self.table]

        if self.operation == "insert":
            assert self.payload is not None
            if self.table == "email_events":
                message_id = self.payload.get("gmail_message_id")
                if any(row.get("gmail_message_id") == message_id for row in rows):
                    raise UniqueViolation()

            row = dict(self.payload)
            row.setdefault("id", f"{self.table}-{len(rows) + 1}")
            if self.table == "applications":
                row.setdefault("kind", "application")
                row.setdefault("stage", "Applied")
                row.setdefault("stage_locked", False)
                row.setdefault("merged_into_id", None)
            rows.append(row)
            return SimpleNamespace(data=[row])

        matched = self._matched_rows(rows)

        if self.operation == "update":
            assert self.payload is not None
            for row in matched:
                row.update(self.payload)
            return SimpleNamespace(data=matched)

        return SimpleNamespace(data=matched)

    def _matched_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        matched = list(rows)
        for operation, column, value in self.filters:
            if operation == "eq":
                matched = [row for row in matched if row.get(column) == value]
            elif operation == "is" and value == "null":
                matched = [row for row in matched if row.get(column) is None]
            elif operation == "in":
                matched = [row for row in matched if row.get(column) in value]
            elif operation == "lt":
                matched = [row for row in matched if row.get(column) < value]
            elif operation == "gte":
                matched = [row for row in matched if row.get(column) >= value]

        if self.order_column:
            matched.sort(
                key=lambda row: str(row.get(self.order_column) or ""),
                reverse=self.order_desc,
            )

        if self.limit_count is not None:
            matched = matched[: self.limit_count]

        return matched


def base_message(**overrides: Any) -> dict[str, Any]:
    message = {
        "gmail_message_id": "gmail-1",
        "gmail_thread_id": "thread-1",
        "from_address": "Jobs <jobs@acme.com>",
        "subject": "Interview invite",
        "received_at": "2026-02-01T12:00:00+00:00",
        "gmail_labels": ["INBOX"],
        "body": "Please interview with us.",
        "raw_snippet": "Please interview with us.",
    }
    message.update(overrides)
    return message


def patch_classifier(monkeypatch, results: list[dict[str, Any]]) -> dict[str, int]:
    state = {"calls": 0}

    def fake_classify_email(message: dict[str, Any], config: object) -> dict[str, Any]:
        index = min(state["calls"], len(results) - 1)
        state["calls"] += 1
        return results[index]

    monkeypatch.setattr(ingest, "classify_email", fake_classify_email)
    return state


def application_result(stage: str = "Interview") -> dict[str, Any]:
    return {
        "category": "application_event",
        "company": "Acme",
        "role": "Analyst",
        "stage": stage,
        "confidence": 0.95,
        "summary": "Application update",
    }


def test_prefilter_skips_without_database_or_classification(monkeypatch) -> None:
    state = patch_classifier(monkeypatch, [application_result()])
    supabase = FakeSupabase()
    message = base_message(from_address="Jobright <noreply@jobright.ai>")

    result = ingest.ingest_message(message, make_config(), supabase)

    assert result.action == "skipped_alert"
    assert result.category == "job_alert"
    assert state["calls"] == 0
    assert len(supabase.tables["email_events"]) == 0


def test_application_event_advances_kind_application(monkeypatch) -> None:
    patch_classifier(monkeypatch, [application_result("Interview")])
    supabase = FakeSupabase()

    result = ingest.ingest_message(base_message(), make_config(), supabase)

    assert result.action == "application_event_matched"
    assert result.advanced_stage is True
    assert len(supabase.tables["email_events"]) == 1
    assert supabase.tables["email_events"][0]["category"] == "application_event"
    assert supabase.tables["email_events"][0]["application_id"] == "app-1"
    assert supabase.tables["applications"][0]["kind"] == "application"
    assert supabase.tables["applications"][0]["stage"] == "Interview"


def test_recruiter_outreach_creates_separate_kind(monkeypatch) -> None:
    patch_classifier(
        monkeypatch,
        [
            {
                "category": "recruiter_outreach",
                "company": "Startup",
                "role": "Chief of Staff",
                "stage": None,
                "confidence": 0.91,
                "summary": "Personal outreach",
            }
        ],
    )
    supabase = FakeSupabase()
    message = base_message(
        gmail_message_id="gmail-outreach",
        from_address="Recruiter <recruiter@startup.com>",
        subject="Role that may fit you",
    )

    result = ingest.ingest_message(message, make_config(), supabase)

    assert result.action == "recruiter_outreach_captured"
    assert result.category == "recruiter_outreach"
    outreach_rows = [
        row for row in supabase.tables["applications"] if row["kind"] == "recruiter_outreach"
    ]
    board_rows = [row for row in supabase.tables["applications"] if row["kind"] == "application"]
    assert len(outreach_rows) == 1
    assert len(board_rows) == 1
    assert outreach_rows[0]["stage"] == "Applied"
    assert supabase.tables["email_events"][0]["category"] == "recruiter_outreach"
    assert supabase.tables["email_events"][0]["detected_stage"] is None


def test_job_alert_and_other_write_nothing(monkeypatch) -> None:
    supabase = FakeSupabase()
    patch_classifier(
        monkeypatch,
        [
            {
                "category": "job_alert",
                "company": "Acme",
                "role": "Analyst",
                "stage": None,
                "confidence": 0.98,
                "summary": "Automated alert",
            },
            {
                "category": "other",
                "company": None,
                "role": None,
                "stage": None,
                "confidence": 0.9,
                "summary": "Newsletter",
            },
        ],
    )

    alert = ingest.ingest_message(base_message(gmail_message_id="alert-1"), make_config(), supabase)
    other = ingest.ingest_message(base_message(gmail_message_id="other-1"), make_config(), supabase)

    assert alert.action == "ignored_job_alert"
    assert other.action == "ignored_other"
    assert len(supabase.tables["email_events"]) == 0
    assert len(supabase.tables["applications"]) == 1


def test_ingest_dedupes_before_classification_and_never_regresses(monkeypatch) -> None:
    state = patch_classifier(
        monkeypatch,
        [application_result("Interview"), application_result("Assessment")],
    )
    supabase = FakeSupabase()
    message = base_message()

    first = ingest.ingest_message(message, make_config(), supabase)
    second = ingest.ingest_message(message, make_config(), supabase)

    assert first.action == "application_event_matched"
    assert first.advanced_stage is True
    assert second.action == "duplicate"
    assert state["calls"] == 1
    assert len(supabase.tables["email_events"]) == 1
    assert supabase.tables["email_events"][0]["application_id"] == "app-1"
    assert supabase.tables["email_events"][0]["advanced_stage"] is True
    assert supabase.tables["applications"][0]["stage"] == "Interview"


def test_match_backfills_placeholder_role_and_company(monkeypatch) -> None:
    patch_classifier(
        monkeypatch,
        [
            {
                "category": "application_event",
                "company": "Acme Corp",
                "role": "Product Strategy and Operations Associate",
                "stage": "Applied",
                "confidence": 0.95,
                "summary": "Application received",
            }
        ],
    )
    supabase = FakeSupabase()
    supabase.tables["applications"][0]["company"] = "Application submitted"
    supabase.tables["applications"][0]["normalized_company"] = "application submitted"
    supabase.tables["applications"][0]["role"] = "Thank you for applying"

    result = ingest.ingest_message(base_message(), make_config(), supabase)

    assert result.action == "application_event_matched"
    application = supabase.tables["applications"][0]
    assert application["company"] == "Acme Corp"
    assert application["normalized_company"] == "acme"
    assert application["role"] == "Product Strategy and Operations Associate"


def test_match_does_not_overwrite_real_existing_role(monkeypatch) -> None:
    patch_classifier(monkeypatch, [application_result("Applied")])
    supabase = FakeSupabase()
    supabase.tables["applications"][0]["role"] = "Senior Analyst"

    result = ingest.ingest_message(base_message(), make_config(), supabase)

    assert result.action == "application_event_matched"
    assert supabase.tables["applications"][0]["role"] == "Senior Analyst"


def test_posting_enrichment_fills_missing_salary_location_and_tags(monkeypatch) -> None:
    patch_classifier(monkeypatch, [application_result("Applied")])
    supabase = FakeSupabase()
    supabase.tables["job_postings"].append(
        {
            "id": "posting-1",
            "company": "Acme",
            "normalized_company": "acme",
            "role": "Analyst",
            "salary": "$120k to $150k",
            "location": "New York, NY",
            "tags": ["Hybrid", "Full-time"],
            "seen_at": "2026-06-01T00:00:00+00:00",
        }
    )

    result = ingest.ingest_message(base_message(), make_config(), supabase)

    assert result.action == "application_event_matched"
    application = supabase.tables["applications"][0]
    assert application["salary"] == "$120k to $150k"
    assert application["location"] == "New York, NY"
    assert application["tags"] == ["Hybrid", "Full-time"]


def test_posting_enrichment_does_nothing_without_role_match(monkeypatch) -> None:
    patch_classifier(monkeypatch, [application_result("Applied")])
    supabase = FakeSupabase()
    supabase.tables["job_postings"].append(
        {
            "id": "posting-1",
            "company": "Acme",
            "normalized_company": "acme",
            "role": "Designer",
            "salary": "$120k to $150k",
            "location": "Remote",
            "tags": ["Remote"],
            "seen_at": "2026-06-01T00:00:00+00:00",
        }
    )

    result = ingest.ingest_message(base_message(), make_config(), supabase)

    assert result.action == "application_event_matched"
    application = supabase.tables["applications"][0]
    assert application["salary"] is None
    assert application["location"] is None
    assert application["tags"] == []

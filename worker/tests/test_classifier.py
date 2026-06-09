from __future__ import annotations

from types import SimpleNamespace

import src.classifier as classifier

from .helpers import make_config


class FakeMessages:
    def __init__(self, responses: list[str]) -> None:
        self.responses = responses

    def create(self, **_: object) -> SimpleNamespace:
        text = self.responses.pop(0)
        return SimpleNamespace(content=[SimpleNamespace(text=text)])


class FakeAnthropicClient:
    def __init__(self, responses: list[str]) -> None:
        self.messages = FakeMessages(responses)


class FailingMessages:
    def create(self, **_: object) -> SimpleNamespace:
        raise RuntimeError("out of credit")


class FailingAnthropicClient:
    def __init__(self) -> None:
        self.messages = FailingMessages()


def patch_anthropic(monkeypatch, responses: list[str]) -> None:
    client = FakeAnthropicClient(responses)
    monkeypatch.setattr(classifier, "Anthropic", lambda api_key: client)


def test_clean_json_response(monkeypatch) -> None:
    patch_anthropic(
        monkeypatch,
        [
            """
            {
              "category": "application_event",
              "company": "Acme",
              "role": "Analyst",
              "stage": "Interview",
              "confidence": 0.91,
              "summary": "Interview invite"
            }
            """
        ],
    )

    result = classifier.classify_email(
        {"subject": "Interview", "from_address": "jobs@acme.com", "body": "Meet us"},
        make_config(),
    )

    assert result["category"] == "application_event"
    assert result["company"] == "Acme"
    assert result["stage"] == "Interview"
    assert result["confidence"] == 0.91


def test_json_with_surrounding_text(monkeypatch) -> None:
    patch_anthropic(
        monkeypatch,
        [
            """
            Sure.
            {"category": "recruiter_outreach", "company": "Globex", "role": "Analyst", "stage": "Interview", "confidence": 0.88, "summary": "Personal outreach"}
            Thanks.
            """
        ],
    )

    result = classifier.classify_email(
        {"subject": "Role for you", "from_address": "recruiter@globex.com", "body": ""},
        make_config(),
    )

    assert result["category"] == "recruiter_outreach"
    assert result["company"] == "Globex"
    assert result["stage"] is None


def test_malformed_response_is_safe(monkeypatch) -> None:
    patch_anthropic(monkeypatch, ["not json"])

    result = classifier.classify_email(
        {"subject": "Hello", "from_address": "friend@example.com", "body": "Lunch"},
        make_config(),
    )

    assert result["category"] == "other"
    assert result["stage"] is None
    assert result["confidence"] == 0.0


def test_call_failure_signals_retry(monkeypatch) -> None:
    monkeypatch.setattr(classifier, "Anthropic", lambda api_key: FailingAnthropicClient())

    result = classifier.classify_email(
        {"subject": "Interview", "from_address": "jobs@acme.com", "body": "Meet us"},
        make_config(),
    )

    assert result is None


def test_prompt_guides_body_role_extraction(monkeypatch) -> None:
    patch_anthropic(
        monkeypatch,
        [
            """
            {
              "category": "application_event",
              "company": "Hello Patient",
              "role": "AI Agent Product Manager",
              "stage": "Applied",
              "confidence": 0.92,
              "summary": "Application confirmation"
            }
            """
        ],
    )

    result = classifier.classify_email(
        {
            "subject": "Thank you for applying",
            "from_address": "noreply@hello-patient.example",
            "body": "Thank you for applying to the AI Agent Product Manager role at Hello Patient.",
        },
        make_config(),
    )

    assert result["role"] == "AI Agent Product Manager"
    assert "specific job title" in classifier.CLASSIFICATION_PROMPT
    assert "Never use the email subject line" in classifier.CLASSIFICATION_PROMPT

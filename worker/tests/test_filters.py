from __future__ import annotations

from src.filters import should_skip_sender


def test_prefilter_skips_known_alert_senders() -> None:
    assert should_skip_sender("Jobright <noreply@jobright.ai>")
    assert should_skip_sender("alerts@ziprecruiter.com")
    assert should_skip_sender("jobalerts-noreply@linkedin.com")
    assert should_skip_sender("alerts@mail.jobalert.indeed.com")
    assert should_skip_sender("noreply@backstage.com")
    assert should_skip_sender("updates@extern.com")
    assert should_skip_sender("hello@joinleland.com")
    assert should_skip_sender("newsletter@gighq.ai")
    assert should_skip_sender("offers@t.mail.coursera.org")


def test_prefilter_allows_application_and_company_senders() -> None:
    assert not should_skip_sender("jobs-noreply@linkedin.com")
    assert not should_skip_sender("Recruiter <recruiter@acme.com>")


def test_prefilter_uses_extra_alert_senders() -> None:
    assert should_skip_sender(
        "Digest <digest@example.com>",
        extra_alert_senders=("digest@example.com",),
    )
    assert should_skip_sender(
        "Digest <updates@mail.alerts.example.com>",
        extra_alert_senders=("alerts.example.com",),
    )

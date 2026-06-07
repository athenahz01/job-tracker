from __future__ import annotations

from src.matcher import extract_sender_domain, normalize_company


def test_normalize_company_suffixes_and_punctuation() -> None:
    assert normalize_company("Acme, Inc.") == "acme"
    assert normalize_company("Globex LLC") == "globex"
    assert normalize_company("Stark Industries, Corporation") == "stark industries"
    assert normalize_company("Wayne-Enterprises Ltd.") == "wayne enterprises"


def test_extract_sender_domain() -> None:
    assert extract_sender_domain("Jobs <jobs@Acme.com>") == "acme.com"

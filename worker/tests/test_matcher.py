from __future__ import annotations

from src.matcher import extract_sender_domain, match_application, normalize_company

from .helpers import make_config


def test_normalize_company_suffixes_and_punctuation() -> None:
    assert normalize_company("Acme, Inc.") == "acme"
    assert normalize_company("Globex LLC") == "globex"
    assert normalize_company("Stark Industries, Corporation") == "stark industries"
    assert normalize_company("Wayne-Enterprises Ltd.") == "wayne enterprises"


def test_extract_sender_domain() -> None:
    assert extract_sender_domain("Jobs <jobs@Acme.com>") == "acme.com"


def test_match_application_requires_role_alignment_for_same_company() -> None:
    application = match_application(
        {
            "from_address": "Careers <careers@eliseai.com>",
            "company": "EliseAI",
            "role": "Customer Success Manager",
        },
        [
            {
                "id": "app-1",
                "company": "EliseAI",
                "normalized_company": "eliseai",
                "company_domain": "eliseai.com",
                "role": "AI Product Manager",
                "last_activity": "2026-01-01T00:00:00+00:00",
            }
        ],
        make_config(),
    )

    assert application is None


def test_match_application_uses_fuzzy_role_match() -> None:
    application = match_application(
        {
            "from_address": "Careers <careers@eliseai.com>",
            "company": "EliseAI",
            "role": "Product Manager",
        },
        [
            {
                "id": "app-1",
                "company": "EliseAI",
                "normalized_company": "eliseai",
                "company_domain": "eliseai.com",
                "role": "Senior Product Manager",
                "last_activity": "2026-01-01T00:00:00+00:00",
            }
        ],
        make_config(),
    )

    assert application is not None
    assert application["id"] == "app-1"

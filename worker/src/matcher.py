from __future__ import annotations

import re
import string
from difflib import SequenceMatcher
from email.utils import parseaddr
from typing import Any, Mapping, Sequence

from .config import Config


COMPANY_SUFFIXES = {
    "incorporated",
    "inc",
    "limited",
    "ltd",
    "llc",
    "corporation",
    "corp",
}

WEAK_SENDER_DOMAINS = {
    "aol.com",
    "ashbyhq.com",
    "gmail.com",
    "googlemail.com",
    "greenhouse.io",
    "hotmail.com",
    "icloud.com",
    "icims.com",
    "indeed.com",
    "indeedemail.com",
    "jobvite.com",
    "lever.co",
    "linkedin.com",
    "live.com",
    "mailgun.org",
    "mandrillapp.com",
    "myworkdayjobs.com",
    "oraclecloud.com",
    "outlook.com",
    "proton.me",
    "protonmail.com",
    "sendgrid.net",
    "smartrecruiters.com",
    "successfactors.com",
    "taleo.net",
    "workablemail.com",
    "workday.com",
    "yahoo.com",
}


def normalize_company(name: str | None) -> str:
    if not name:
        return ""

    punctuation_map = str.maketrans({char: " " for char in string.punctuation})
    normalized = name.lower().strip().translate(punctuation_map)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    parts = normalized.split()

    while parts and parts[-1] in COMPANY_SUFFIXES:
        parts.pop()

    return " ".join(parts)


def extract_sender_domain(from_address: str | None) -> str | None:
    if not from_address:
        return None

    _, parsed_address = parseaddr(from_address)
    address = parsed_address or from_address
    if "@" not in address:
        return None

    domain = address.rsplit("@", 1)[1].lower().strip(" >")
    if domain.startswith("www."):
        domain = domain[4:]

    return domain or None


def is_weak_sender_domain(domain: str | None) -> bool:
    if not domain:
        return True
    return (
        domain in WEAK_SENDER_DOMAINS
        or any(domain.endswith(f".{weak}") for weak in WEAK_SENDER_DOMAINS)
        or domain.startswith("noreply.")
    )


def match_application(
    email_event: Mapping[str, Any],
    applications: Sequence[Mapping[str, Any]],
    config: Config,
) -> Mapping[str, Any] | None:
    """Match a classified email event to an existing application."""
    sender_domain = extract_sender_domain(_as_string(email_event.get("from_address")))

    if sender_domain and not is_weak_sender_domain(sender_domain):
        for application in applications:
            company_domain = _as_string(application.get("company_domain"))
            if company_domain and company_domain.lower().strip() == sender_domain:
                return application

    classified_company = normalize_company(_as_string(email_event.get("company")))
    if not classified_company:
        return None

    best_application: Mapping[str, Any] | None = None
    best_ratio = 0.0

    for application in applications:
        candidate = _as_string(application.get("normalized_company"))
        if not candidate:
            candidate = normalize_company(_as_string(application.get("company")))

        ratio = SequenceMatcher(None, classified_company, candidate).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_application = application

    if best_application and best_ratio >= config.match_confidence_threshold:
        return best_application

    return None


def _as_string(value: Any) -> str | None:
    return value if isinstance(value, str) else None

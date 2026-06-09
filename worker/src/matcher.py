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

ROLE_MATCH_THRESHOLD = 0.62
ROLE_PLACEHOLDER_PHRASES = (
    "thank you for applying",
    "thanks for applying",
    "application received",
    "application submitted",
)

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
    classified_company = normalize_company(_as_string(email_event.get("company")))
    candidates = _company_candidates(
        applications,
        classified_company,
        sender_domain,
        config,
    )

    if not candidates:
        return None

    classified_role = _normalize_role(_as_string(email_event.get("role")))
    if classified_role:
        role_match = _best_role_match(classified_role, candidates)
        if role_match:
            return role_match

        blank_role_candidates = [
            application for application in candidates if not _normalize_role(_as_string(application.get("role")))
        ]
        role_bearing_candidates = [
            application for application in candidates if _normalize_role(_as_string(application.get("role")))
        ]
        if blank_role_candidates and not role_bearing_candidates:
            return _most_recent_application(blank_role_candidates)

        return None

    # Some lifecycle emails omit the title. In that case, attach to the most
    # recent company match instead of creating a blank duplicate.
    return _most_recent_application(candidates)


def _company_candidates(
    applications: Sequence[Mapping[str, Any]],
    classified_company: str,
    sender_domain: str | None,
    config: Config,
) -> list[Mapping[str, Any]]:
    candidates: list[Mapping[str, Any]] = []
    seen_ids: set[str] = set()

    if sender_domain and not is_weak_sender_domain(sender_domain):
        for application in applications:
            company_domain = _as_string(application.get("company_domain"))
            if company_domain and company_domain.lower().strip() == sender_domain:
                _append_unique(candidates, seen_ids, application)

    if not classified_company:
        return candidates

    for application in applications:
        candidate = _as_string(application.get("normalized_company"))
        if not candidate:
            candidate = normalize_company(_as_string(application.get("company")))

        ratio = SequenceMatcher(None, classified_company, candidate).ratio()
        if ratio >= config.match_confidence_threshold:
            _append_unique(candidates, seen_ids, application)

    return candidates


def _append_unique(
    candidates: list[Mapping[str, Any]],
    seen_ids: set[str],
    application: Mapping[str, Any],
) -> None:
    key = str(application.get("id") or id(application))
    if key in seen_ids:
        return
    seen_ids.add(key)
    candidates.append(application)


def _best_role_match(
    classified_role: str,
    applications: Sequence[Mapping[str, Any]],
) -> Mapping[str, Any] | None:
    best_application: Mapping[str, Any] | None = None
    best_score = 0.0
    for application in applications:
        candidate = _normalize_role(_as_string(application.get("role")))
        if not candidate:
            continue
        score = _role_similarity(classified_role, candidate)
        if score > best_score:
            best_score = score
            best_application = application

    return (
        best_application
        if best_application is not None and best_score >= ROLE_MATCH_THRESHOLD
        else None
    )


def _role_similarity(left: str, right: str) -> float:
    score = SequenceMatcher(None, left, right).ratio()
    if left in right or right in left:
        score = max(score, 0.9)
    return score


def _most_recent_application(
    applications: Sequence[Mapping[str, Any]],
) -> Mapping[str, Any] | None:
    if not applications:
        return None
    return max(applications, key=_application_recency_key)


def _application_recency_key(application: Mapping[str, Any]) -> str:
    for key in ("last_activity", "first_seen", "created_at"):
        value = _as_string(application.get(key))
        if value:
            return value
    return ""


def _normalize_role(role: str | None) -> str:
    if not role:
        return ""

    normalized = re.sub(r"[^a-z0-9]+", " ", role.lower()).strip()
    if any(phrase in normalized for phrase in ROLE_PLACEHOLDER_PHRASES):
        return ""
    return normalized


def _as_string(value: Any) -> str | None:
    return value if isinstance(value, str) else None

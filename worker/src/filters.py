from __future__ import annotations

from email.utils import parseaddr
from typing import Iterable


ALERT_ADDRESSES = {
    "alerts@ziprecruiter.com",
    "jobalerts-noreply@linkedin.com",
    "lajobs@backstage.com",
    "messages-noreply@linkedin.com",
    "noreply@backstage.com",
    "noreply@jobright.ai",
    "updates@extern.com",
}

ALERT_DOMAINS = {
    "email.coursera.org",
    "gighq.ai",
    "joinleland.com",
    "jobalert.indeed.com",
    "mail.coursera.org",
    "match.indeed.com",
    "t.mail.coursera.org",
}


def should_skip_sender(
    from_address: str | None,
    extra_alert_senders: Iterable[str] = (),
) -> bool:
    address, domain = _extract_address_and_domain(from_address)
    if not address:
        return False

    extra_addresses, extra_domains = _split_extra_senders(extra_alert_senders)
    if address in ALERT_ADDRESSES or address in extra_addresses:
        return True

    return _domain_matches(domain, ALERT_DOMAINS) or _domain_matches(domain, extra_domains)


def _extract_address_and_domain(from_address: str | None) -> tuple[str, str]:
    if not from_address:
        return "", ""

    _, parsed_address = parseaddr(from_address)
    address = (parsed_address or from_address).strip().lower()
    if "@" not in address:
        return address, address

    domain = address.rsplit("@", 1)[1].strip(" >")
    return address, domain


def _split_extra_senders(senders: Iterable[str]) -> tuple[set[str], set[str]]:
    addresses: set[str] = set()
    domains: set[str] = set()

    for sender in senders:
        normalized = sender.strip().lower()
        if not normalized:
            continue
        if "@" in normalized:
            addresses.add(normalized)
        else:
            domains.add(normalized)

    return addresses, domains


def _domain_matches(domain: str, candidates: set[str]) -> bool:
    if not domain:
        return False
    return any(domain == candidate or domain.endswith(f".{candidate}") for candidate in candidates)

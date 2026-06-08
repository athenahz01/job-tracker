from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Any, Mapping

from .classifier import classify_email
from .config import Config
from .filters import should_skip_sender
from .matcher import extract_sender_domain, match_application, normalize_company
from .stages import STAGES, resolve_forward_stage


logger = logging.getLogger(__name__)

RAW_SNIPPET_CHARS = 500
WRITTEN_CATEGORIES = {"application_event", "recruiter_outreach"}
POSTING_LOOKBACK_DAYS = 45
ROLE_MATCH_THRESHOLD = 0.62
PLACEHOLDER_PHRASES = (
    "thank you for applying",
    "thanks for applying",
    "application received",
    "application submitted",
    "application has been submitted",
    "your application was submitted",
    "your application has been submitted",
)


@dataclass(frozen=True)
class IngestResult:
    gmail_message_id: str
    action: str
    category: str | None = None
    is_job_related: bool | None = None
    detected_stage: str | None = None
    confidence: float | None = None
    matched_application_id: str | None = None
    advanced_stage: bool = False
    orphan_created: bool = False
    error: str | None = None


def ingest_message(message: Mapping[str, Any], config: Config, supabase: Any) -> IngestResult:
    """Turn one Gmail message into an email_event and any needed application update."""
    gmail_message_id = str(message.get("gmail_message_id") or "")
    if not gmail_message_id:
        logger.warning("skipping message without gmail_message_id")
        return IngestResult(gmail_message_id="", action="skipped", error="missing id")

    try:
        prefilter_result = _prefilter_result(message, config, gmail_message_id)
        if prefilter_result:
            return prefilter_result

        existing_event = _find_existing_event(supabase, gmail_message_id)
        if existing_event:
            return IngestResult(gmail_message_id=gmail_message_id, action="duplicate")

        classification = classify_email(message, config)
        category = str(classification.get("category") or "other")

        if category not in WRITTEN_CATEGORIES:
            return IngestResult(
                gmail_message_id=gmail_message_id,
                action=f"ignored_{category}",
                category=category,
                is_job_related=False,
                detected_stage=None,
                confidence=float(classification.get("confidence") or 0.0),
            )

        event_row = _build_event_row(message, classification)

        try:
            event = _insert_event(supabase, event_row)
        except Exception as error:
            if _is_unique_violation(error):
                logger.info("email event already inserted for %s", gmail_message_id)
                return IngestResult(gmail_message_id=gmail_message_id, action="duplicate")
            raise

        if category == "application_event":
            return _route_application_event(
                supabase,
                event,
                message,
                classification,
                config,
                gmail_message_id,
            )

        return _route_recruiter_outreach(
            supabase,
            event,
            message,
            classification,
            gmail_message_id,
        )
    except Exception as error:
        logger.exception("failed to ingest Gmail message %s", gmail_message_id)
        return IngestResult(
            gmail_message_id=gmail_message_id,
            action="failed",
            error=str(error),
        )


def preview_message(message: Mapping[str, Any], config: Config, supabase: Any) -> IngestResult:
    gmail_message_id = str(message.get("gmail_message_id") or "")
    if not gmail_message_id:
        return IngestResult(gmail_message_id="", action="skipped", error="missing id")

    try:
        prefilter_result = _prefilter_result(message, config, gmail_message_id)
        if prefilter_result:
            return prefilter_result

        if _find_existing_event(supabase, gmail_message_id):
            return IngestResult(gmail_message_id=gmail_message_id, action="duplicate")

        classification = classify_email(message, config)
        category = str(classification.get("category") or "other")
        confidence = float(classification.get("confidence") or 0.0)

        if category == "job_alert":
            return IngestResult(
                gmail_message_id=gmail_message_id,
                action="ignored_job_alert",
                category=category,
                is_job_related=False,
                confidence=confidence,
            )

        if category == "other":
            return IngestResult(
                gmail_message_id=gmail_message_id,
                action="ignored_other",
                category=category,
                is_job_related=False,
                confidence=confidence,
            )

        if category == "application_event":
            applications = _load_candidate_applications(supabase, "application")
            matched_application = match_application(
                _email_event_for_matching(message, classification),
                applications,
                config,
            )
            if matched_application:
                return IngestResult(
                    gmail_message_id=gmail_message_id,
                    action="application_event_matched",
                    category=category,
                    is_job_related=True,
                    detected_stage=_as_string(classification.get("stage")),
                    confidence=confidence,
                    matched_application_id=str(matched_application.get("id")),
                )

            if confidence >= config.orphan_confidence_threshold:
                return IngestResult(
                    gmail_message_id=gmail_message_id,
                    action="application_event_create_orphan",
                    category=category,
                    is_job_related=True,
                    detected_stage=_as_string(classification.get("stage")),
                    confidence=confidence,
                    orphan_created=True,
                )

            return IngestResult(
                gmail_message_id=gmail_message_id,
                action="application_event_low_confidence",
                category=category,
                is_job_related=True,
                detected_stage=_as_string(classification.get("stage")),
                confidence=confidence,
            )

        if category == "recruiter_outreach":
            matched_outreach = _match_recruiter_outreach(
                _load_candidate_applications(supabase, "recruiter_outreach"),
                extract_sender_domain(_as_string(message.get("from_address"))),
            )
            return IngestResult(
                gmail_message_id=gmail_message_id,
                action="recruiter_outreach_captured",
                category=category,
                is_job_related=True,
                confidence=confidence,
                matched_application_id=(
                    str(matched_outreach.get("id")) if matched_outreach else None
                ),
                orphan_created=matched_outreach is None,
            )

        return IngestResult(
            gmail_message_id=gmail_message_id,
            action="ignored_other",
            category="other",
            is_job_related=False,
            confidence=confidence,
        )
    except Exception as error:
        logger.exception("failed to preview Gmail message %s", gmail_message_id)
        return IngestResult(
            gmail_message_id=gmail_message_id,
            action="failed",
            error=str(error),
        )


def _prefilter_result(
    message: Mapping[str, Any],
    config: Config,
    gmail_message_id: str,
) -> IngestResult | None:
    if should_skip_sender(
        _as_string(message.get("from_address")),
        config.extra_alert_senders,
    ):
        return IngestResult(
            gmail_message_id=gmail_message_id,
            action="skipped_alert",
            category="job_alert",
            is_job_related=False,
        )
    return None


def _route_application_event(
    supabase: Any,
    event: Mapping[str, Any],
    message: Mapping[str, Any],
    classification: Mapping[str, Any],
    config: Config,
    gmail_message_id: str,
) -> IngestResult:
    applications = _load_candidate_applications(supabase, "application")
    matched_application = match_application(
        _email_event_for_matching(message, classification),
        applications,
        config,
    )

    if matched_application:
        return _apply_matched_application(
            supabase,
            event,
            message,
            classification,
            matched_application,
            gmail_message_id,
        )

    if float(classification.get("confidence") or 0.0) >= config.orphan_confidence_threshold:
        return _create_orphan_application(
            supabase,
            event,
            message,
            classification,
            gmail_message_id,
            kind="application",
        )

    return IngestResult(
        gmail_message_id=gmail_message_id,
        action="application_event_low_confidence",
        category="application_event",
        is_job_related=True,
        detected_stage=_as_string(classification.get("stage")),
        confidence=float(classification.get("confidence") or 0.0),
    )


def _route_recruiter_outreach(
    supabase: Any,
    event: Mapping[str, Any],
    message: Mapping[str, Any],
    classification: Mapping[str, Any],
    gmail_message_id: str,
) -> IngestResult:
    sender_domain = extract_sender_domain(_as_string(message.get("from_address")))
    existing = _match_recruiter_outreach(
        _load_candidate_applications(supabase, "recruiter_outreach"),
        sender_domain,
    )

    if existing:
        application_id = str(existing.get("id"))
        last_activity = _later_timestamp(existing.get("last_activity"), message.get("received_at"))
        updates = {"last_activity": last_activity} if last_activity else {}
        if updates:
            _execute(
                supabase.table("applications").update(updates).eq("id", application_id),
                "update recruiter outreach",
            )
        _update_event(supabase, event, {"application_id": application_id})
        return IngestResult(
            gmail_message_id=gmail_message_id,
            action="recruiter_outreach_captured",
            category="recruiter_outreach",
            is_job_related=True,
            confidence=float(classification.get("confidence") or 0.0),
            matched_application_id=application_id,
        )

    return _create_orphan_application(
        supabase,
        event,
        message,
        classification,
        gmail_message_id,
        kind="recruiter_outreach",
    )


def _find_existing_event(supabase: Any, gmail_message_id: str) -> Mapping[str, Any] | None:
    response = _execute(
        supabase.table("email_events")
        .select("*")
        .eq("gmail_message_id", gmail_message_id)
        .limit(1),
        "find existing email event",
    )
    rows = _response_rows(response)
    return rows[0] if rows else None


def _insert_event(supabase: Any, event_row: Mapping[str, Any]) -> Mapping[str, Any]:
    try:
        response = supabase.table("email_events").insert(dict(event_row)).execute()
    except Exception as error:
        if _is_unique_violation(error):
            raise
        logger.exception("Supabase call failed: insert email event")
        raise

    rows = _response_rows(response)
    if rows:
        return rows[0]

    gmail_message_id = str(event_row["gmail_message_id"])
    existing = _find_existing_event(supabase, gmail_message_id)
    if existing:
        return existing

    raise RuntimeError("Email event insert returned no row.")


def _load_candidate_applications(supabase: Any, kind: str) -> list[Mapping[str, Any]]:
    response = _execute(
        supabase.table("applications")
        .select("*")
        .eq("kind", kind)
        .is_("merged_into_id", "null"),
        f"load {kind} applications",
    )
    return _response_rows(response)


def _match_recruiter_outreach(
    applications: list[Mapping[str, Any]],
    sender_domain: str | None,
) -> Mapping[str, Any] | None:
    if not sender_domain:
        return None

    for application in applications:
        company_domain = _as_string(application.get("company_domain"))
        if company_domain and company_domain.lower().strip() == sender_domain:
            return application

    return None


def _apply_matched_application(
    supabase: Any,
    event: Mapping[str, Any],
    message: Mapping[str, Any],
    classification: Mapping[str, Any],
    application: Mapping[str, Any],
    gmail_message_id: str,
) -> IngestResult:
    application_id = str(application.get("id"))
    event_updates: dict[str, Any] = {"application_id": application_id}
    application_updates: dict[str, Any] = {}
    advanced_stage = False

    current_stage = str(application.get("stage") or "Applied")
    next_stage = resolve_forward_stage(current_stage, _as_string(classification.get("stage")))
    if next_stage != current_stage and not bool(application.get("stage_locked")):
        application_updates["stage"] = next_stage
        event_updates["advanced_stage"] = True
        advanced_stage = True

    last_activity = _later_timestamp(
        application.get("last_activity"),
        message.get("received_at"),
    )
    if last_activity:
        application_updates["last_activity"] = last_activity

    sender_domain = extract_sender_domain(_as_string(message.get("from_address")))
    if sender_domain and not application.get("company_domain"):
        application_updates["company_domain"] = sender_domain

    _add_identity_backfill_updates(application, classification, application_updates)

    enriched_application = {**application, **application_updates}
    application_updates.update(
        _posting_enrichment_updates(
            supabase,
            enriched_application,
            lookup_company=_as_string(enriched_application.get("company")),
            lookup_role=(
                _as_string(classification.get("role"))
                or _as_string(enriched_application.get("role"))
            ),
        )
    )

    if application_updates:
        _execute(
            supabase.table("applications")
            .update(application_updates)
            .eq("id", application_id),
            "update matched application",
        )

    _update_event(supabase, event, event_updates)

    return IngestResult(
        gmail_message_id=gmail_message_id,
        action="application_event_matched",
        category="application_event",
        is_job_related=True,
        detected_stage=_as_string(classification.get("stage")),
        confidence=float(classification.get("confidence") or 0.0),
        matched_application_id=application_id,
        advanced_stage=advanced_stage,
    )


def _create_orphan_application(
    supabase: Any,
    event: Mapping[str, Any],
    message: Mapping[str, Any],
    classification: Mapping[str, Any],
    gmail_message_id: str,
    kind: str,
) -> IngestResult:
    sender_domain = extract_sender_domain(_as_string(message.get("from_address")))
    company = _as_string(classification.get("company")) or sender_domain or "Unknown Company"
    received_at = _coerce_timestamp(message.get("received_at")) or _now_iso()

    application_row: dict[str, Any] = {
        "company": company,
        "normalized_company": normalize_company(company),
        "company_domain": sender_domain,
        "role": _as_string(classification.get("role")),
        "source": "email",
        "kind": kind,
        "is_orphan": True,
        "first_seen": received_at,
        "last_activity": received_at,
    }

    if kind == "application":
        detected_stage = _as_string(classification.get("stage"))
        application_row["stage"] = detected_stage if detected_stage in STAGES else "Applied"
        application_row.update(
            _posting_enrichment_updates(
                supabase,
                application_row,
                lookup_company=company,
                lookup_role=_as_string(classification.get("role")),
            )
        )

    response = _execute(
        supabase.table("applications").insert(application_row),
        f"create {kind} application",
    )
    rows = _response_rows(response)
    if not rows:
        raise RuntimeError("Application insert returned no row.")

    application_id = str(rows[0]["id"])
    _update_event(supabase, event, {"application_id": application_id})

    category = "application_event" if kind == "application" else "recruiter_outreach"
    return IngestResult(
        gmail_message_id=gmail_message_id,
        action=(
            "application_event_create_orphan"
            if kind == "application"
            else "recruiter_outreach_captured"
        ),
        category=category,
        is_job_related=True,
        detected_stage=(
            _as_string(classification.get("stage")) if kind == "application" else None
        ),
        confidence=float(classification.get("confidence") or 0.0),
        matched_application_id=application_id,
        orphan_created=True,
    )


def _add_identity_backfill_updates(
    application: Mapping[str, Any],
    classification: Mapping[str, Any],
    updates: dict[str, Any],
) -> None:
    classified_role = _as_string(classification.get("role"))
    if is_placeholder_text(application.get("role")) and _is_real_text(classified_role):
        updates["role"] = classified_role

    classified_company = _as_string(classification.get("company"))
    if is_placeholder_text(application.get("company")) and _is_real_text(classified_company):
        updates["company"] = classified_company
        updates["normalized_company"] = normalize_company(classified_company)


def _posting_enrichment_updates(
    supabase: Any,
    application: Mapping[str, Any],
    lookup_company: str | None,
    lookup_role: str | None,
) -> dict[str, Any]:
    try:
        return _posting_enrichment_updates_inner(
            supabase,
            application,
            lookup_company,
            lookup_role,
        )
    except Exception:
        logger.exception("posting enrichment lookup failed")
        return {}


def _posting_enrichment_updates_inner(
    supabase: Any,
    application: Mapping[str, Any],
    lookup_company: str | None,
    lookup_role: str | None,
) -> dict[str, Any]:
    if not lookup_company or not _is_real_text(lookup_role):
        return {}

    posting = _find_recent_posting(supabase, lookup_company, lookup_role)
    if not posting:
        return {}

    updates: dict[str, Any] = {}
    if not _as_string(application.get("salary")) and _as_string(posting.get("salary")):
        updates["salary"] = _as_string(posting.get("salary"))

    if not _as_string(application.get("location")) and _as_string(posting.get("location")):
        updates["location"] = _as_string(posting.get("location"))

    existing_tags = application.get("tags")
    if not existing_tags and posting.get("tags"):
        tags = _clean_tags(posting.get("tags"))
        if tags:
            updates["tags"] = tags

    posting_role = _as_string(posting.get("role"))
    if is_placeholder_text(application.get("role")) and _is_real_text(posting_role):
        updates["role"] = posting_role

    return updates


def _find_recent_posting(
    supabase: Any,
    company: str,
    role: str,
) -> Mapping[str, Any] | None:
    normalized_company = normalize_company(company)
    if not normalized_company:
        return None

    cutoff = (datetime.now(timezone.utc) - timedelta(days=POSTING_LOOKBACK_DAYS)).isoformat()
    response = _execute(
        supabase.table("job_postings")
        .select("*")
        .eq("normalized_company", normalized_company)
        .gte("seen_at", cutoff)
        .order("seen_at", desc=True),
        "load recent job postings",
    )
    return _best_posting_match(_response_rows(response), role)


def _best_posting_match(
    postings: list[Mapping[str, Any]],
    role: str,
) -> Mapping[str, Any] | None:
    target = _normalize_role_for_match(role)
    if not target:
        return None

    best: Mapping[str, Any] | None = None
    best_score = 0.0
    for posting in postings:
        candidate = _normalize_role_for_match(_as_string(posting.get("role")))
        if not candidate:
            continue
        score = SequenceMatcher(None, target, candidate).ratio()
        if target in candidate or candidate in target:
            score = max(score, 0.9)
        if score > best_score:
            best_score = score
            best = posting

    return best if best is not None and best_score >= ROLE_MATCH_THRESHOLD else None


def is_placeholder_text(value: Any) -> bool:
    text = _as_string(value)
    if not text or not text.strip():
        return True

    normalized = re.sub(r"\s+", " ", text).strip().lower()
    return any(phrase in normalized for phrase in PLACEHOLDER_PHRASES)


def _is_real_text(value: Any) -> bool:
    return not is_placeholder_text(value)


def _normalize_role_for_match(value: str | None) -> str:
    if not value or is_placeholder_text(value):
        return ""
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _clean_tags(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return []

    seen: set[str] = set()
    tags: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        tag = item.strip()[:40]
        key = tag.lower()
        if not tag or key in seen:
            continue
        seen.add(key)
        tags.append(tag)
        if len(tags) >= 20:
            break
    return tags


def _update_event(
    supabase: Any,
    event: Mapping[str, Any],
    updates: Mapping[str, Any],
) -> None:
    event_id = event.get("id")
    if not event_id:
        event_id = event.get("gmail_message_id")
        column = "gmail_message_id"
    else:
        column = "id"

    _execute(
        supabase.table("email_events").update(dict(updates)).eq(column, str(event_id)),
        "update email event",
    )


def _build_event_row(
    message: Mapping[str, Any],
    classification: Mapping[str, Any],
) -> dict[str, Any]:
    category = str(classification.get("category") or "other")
    return {
        "gmail_message_id": message.get("gmail_message_id"),
        "gmail_thread_id": message.get("gmail_thread_id"),
        "from_address": message.get("from_address"),
        "subject": message.get("subject"),
        "received_at": message.get("received_at"),
        "gmail_labels": message.get("gmail_labels") or [],
        "category": category,
        "is_job_related": category in WRITTEN_CATEGORIES,
        "detected_stage": (
            classification.get("stage") if category == "application_event" else None
        ),
        "confidence": classification.get("confidence"),
        "company": classification.get("company"),
        "role": classification.get("role"),
        "summary": classification.get("summary"),
        "raw_snippet": _raw_snippet(message),
    }


def _email_event_for_matching(
    message: Mapping[str, Any],
    classification: Mapping[str, Any],
) -> dict[str, Any]:
    return {
        "from_address": message.get("from_address"),
        "company": classification.get("company"),
        "role": classification.get("role"),
    }


def _raw_snippet(message: Mapping[str, Any]) -> str:
    value = message.get("raw_snippet") or message.get("body") or ""
    return str(value).strip()[:RAW_SNIPPET_CHARS]


def _later_timestamp(existing: Any, incoming: Any) -> str | None:
    existing_at = _parse_datetime(existing)
    incoming_at = _parse_datetime(incoming) or datetime.now(timezone.utc)
    if existing_at and existing_at > incoming_at:
        return existing_at.isoformat()
    return incoming_at.isoformat()


def _coerce_timestamp(value: Any) -> str | None:
    parsed = _parse_datetime(value)
    return parsed.isoformat() if parsed else None


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _execute(query: Any, context: str) -> Any:
    try:
        return query.execute()
    except Exception:
        logger.exception("Supabase call failed: %s", context)
        raise


def _response_rows(response: Any) -> list[Mapping[str, Any]]:
    data = getattr(response, "data", None)
    if data is None and isinstance(response, Mapping):
        data = response.get("data")
    return list(data or [])


def _is_unique_violation(error: Exception) -> bool:
    code = getattr(error, "code", "")
    message = str(error).lower()
    return code == "23505" or "duplicate" in message or "unique" in message


def _as_string(value: Any) -> str | None:
    return value if isinstance(value, str) else None

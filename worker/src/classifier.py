from __future__ import annotations

import json
import logging
import re
from typing import Any, Mapping

from anthropic import Anthropic

from .config import Config
from .stages import STAGES


CLASSIFICATION_PROMPT = """
You classify emails for a personal job application tracker.
Return strict JSON only.
The JSON object must contain exactly these keys:
category, company, role, stage, confidence, summary.
category must be one of application_event, recruiter_outreach, job_alert, other.

Use application_event only for emails about the user's own application history:
application received or confirmation, online assessment invite, phone screen or interview scheduling, interview follow up, rejection, offer, or a status update on the user's own candidacy.

Use recruiter_outreach for a real person reaching out personally to gauge the user's interest in a specific role where the user has not applied.

Use job_alert for automated job board recommendations and digests, such as "X just posted a 76% match role," "company is hiring for," "jobs you may like," or "N new roles available."

Use other for anything not job related, including marketing, shopping, newsletters, and personal mail.

stage is meaningful only for application_event. For every other category, stage must be null.
When stage is not null, it must be one of Saved, Applied, Assessment, Phone Screen, Interview, Final, Offer, Rejected, Ghosted.
Use null when company, role, or stage cannot be determined.
confidence must be a number between 0 and 1.
Do not include markdown, comments, explanations, or any text around the JSON.
""".strip()


logger = logging.getLogger(__name__)

CATEGORIES = {"application_event", "recruiter_outreach", "job_alert", "other"}
ESCALATION_CATEGORIES = {"application_event", "recruiter_outreach"}


def classify_email(email: Mapping[str, Any], config: Config) -> dict[str, Any]:
    """Classify one email into job tracking fields."""
    result = _classify_with_model(config.anthropic_model_primary, email, config)
    if result is None:
        return _safe_result()

    if (
        result["category"] in ESCALATION_CATEGORIES
        and result["confidence"] < config.escalate_confidence_threshold
    ):
        result = _classify_with_model(config.anthropic_model_escalation, email, config)
        if result is None:
            return _safe_result()

    if (
        config.use_hard_model
        and result["category"] in ESCALATION_CATEGORIES
        and result["confidence"] < config.escalate_confidence_threshold
    ):
        result = _classify_with_model(config.anthropic_model_hard, email, config)
        if result is None:
            return _safe_result()

    return result


def parse_classification_response(text: str) -> dict[str, Any] | None:
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        value = _extract_first_json_object(text)

    if not isinstance(value, dict):
        logger.warning("Claude returned classification that was not a JSON object")
        return None

    return value


def _classify_with_model(
    model: str,
    email: Mapping[str, Any],
    config: Config,
) -> dict[str, Any] | None:
    client = Anthropic(api_key=config.anthropic_api_key)

    try:
        response = client.messages.create(
            model=model,
            max_tokens=600,
            temperature=0,
            system=CLASSIFICATION_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": _build_user_message(email),
                }
            ],
        )
    except Exception:
        logger.exception("Anthropic classification call failed with model %s", model)
        return None

    raw_text = _response_text(response)
    parsed = parse_classification_response(raw_text)
    if parsed is None:
        logger.warning("could not parse Claude classification response")
        return None

    return _validate_result(parsed)


def _build_user_message(email: Mapping[str, Any]) -> str:
    subject = _clean_text(email.get("subject")) or ""
    from_address = _clean_text(email.get("from_address")) or ""
    body = _clean_text(email.get("body")) or _clean_text(email.get("raw_snippet")) or ""
    body = body[:6000]

    return (
        "Classify this email. Return the strict JSON object only.\n\n"
        f"Subject: {subject}\n"
        f"From: {from_address}\n"
        f"Body:\n{body}"
    )


def _response_text(response: Any) -> str:
    parts: list[str] = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if text is None and isinstance(block, dict):
            text = block.get("text")
        if text:
            parts.append(str(text))
    return "\n".join(parts).strip()


def _extract_first_json_object(text: str) -> dict[str, Any] | None:
    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", text):
        try:
            value, _ = decoder.raw_decode(text[match.start() :])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    return None


def _validate_result(value: Mapping[str, Any]) -> dict[str, Any]:
    category = _clean_text(value.get("category")) or "other"
    if category not in CATEGORIES:
        category = "other"

    stage = _clean_text(value.get("stage"))
    if category != "application_event" or stage not in STAGES:
        stage = None

    confidence = _coerce_confidence(value.get("confidence"))

    return {
        "category": category,
        "company": _clean_text(value.get("company")),
        "role": _clean_text(value.get("role")),
        "stage": stage,
        "confidence": confidence,
        "summary": _clean_text(value.get("summary")),
    }


def _coerce_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        confidence = 0.0
    return max(0.0, min(confidence, 1.0))


def _clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _safe_result() -> dict[str, Any]:
    return {
        "category": "other",
        "company": None,
        "role": None,
        "stage": None,
        "confidence": 0.0,
        "summary": None,
    }

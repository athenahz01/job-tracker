from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    anthropic_api_key: str
    anthropic_model_primary: str
    anthropic_model_escalation: str
    anthropic_model_hard: str
    use_hard_model: bool
    escalate_confidence_threshold: float
    supabase_url: str
    supabase_service_role_key: str
    gmail_oauth_client_id: str
    gmail_oauth_client_secret: str
    gmail_oauth_refresh_token: str
    gmail_user_email: str
    gmail_poll_interval_minutes: int
    ghosting_days: int
    match_confidence_threshold: float
    orphan_confidence_threshold: float
    extra_alert_senders: Tuple[str, ...]
    tz: str

    @property
    def timezone(self) -> ZoneInfo:
        return ZoneInfo(self.tz)


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _integer(name: str, default: int) -> int:
    value = os.getenv(name, str(default))
    try:
        parsed = int(value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer.") from error
    if parsed <= 0:
        raise RuntimeError(f"{name} must be greater than zero.")
    return parsed


def _float(name: str, default: float) -> float:
    value = os.getenv(name, str(default))
    try:
        return float(value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be a number.") from error


def _boolean(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default

    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes"}:
        return True
    if normalized in {"0", "false", "no"}:
        return False

    raise RuntimeError(f"{name} must be true or false.")


def _csv(name: str) -> tuple[str, ...]:
    value = os.getenv(name, "")
    return tuple(part.strip().lower() for part in value.split(",") if part.strip())


def load_config() -> Config:
    load_dotenv()

    tz = os.getenv("TZ", "America/New_York")
    try:
        ZoneInfo(tz)
    except ZoneInfoNotFoundError as error:
        raise RuntimeError(f"TZ is not a valid timezone: {tz}") from error

    return Config(
        anthropic_api_key=_required("ANTHROPIC_API_KEY"),
        anthropic_model_primary=os.getenv("ANTHROPIC_MODEL_PRIMARY", "claude-haiku-4-5"),
        anthropic_model_escalation=os.getenv(
            "ANTHROPIC_MODEL_ESCALATION", "claude-sonnet-4-6"
        ),
        anthropic_model_hard=os.getenv("ANTHROPIC_MODEL_HARD", "claude-opus-4-6"),
        use_hard_model=_boolean("USE_HARD_MODEL", False),
        escalate_confidence_threshold=_float("ESCALATE_CONFIDENCE_THRESHOLD", 0.7),
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        gmail_oauth_client_id=_required("GMAIL_OAUTH_CLIENT_ID"),
        gmail_oauth_client_secret=_required("GMAIL_OAUTH_CLIENT_SECRET"),
        gmail_oauth_refresh_token=_required("GMAIL_OAUTH_REFRESH_TOKEN"),
        gmail_user_email=_required("GMAIL_USER_EMAIL"),
        gmail_poll_interval_minutes=_integer("GMAIL_POLL_INTERVAL_MINUTES", 3),
        ghosting_days=_integer("GHOSTING_DAYS", 21),
        match_confidence_threshold=_float("MATCH_CONFIDENCE_THRESHOLD", 0.6),
        orphan_confidence_threshold=_float("ORPHAN_CONFIDENCE_THRESHOLD", 0.7),
        extra_alert_senders=_csv("EXTRA_ALERT_SENDERS"),
        tz=tz,
    )

from __future__ import annotations

from src.config import Config


def make_config() -> Config:
    return Config(
        anthropic_api_key="test",
        anthropic_model_primary="haiku",
        anthropic_model_escalation="sonnet",
        anthropic_model_hard="opus",
        use_hard_model=False,
        escalate_confidence_threshold=0.7,
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="test",
        gmail_oauth_client_id="test",
        gmail_oauth_client_secret="test",
        gmail_oauth_refresh_token="test",
        gmail_user_email="user@example.com",
        gmail_poll_interval_minutes=3,
        ghosting_days=21,
        match_confidence_threshold=0.6,
        orphan_confidence_threshold=0.7,
        extra_alert_senders=(),
        tz="America/New_York",
    )

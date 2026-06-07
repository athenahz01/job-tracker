from __future__ import annotations

from supabase import Client, create_client

from .config import Config, load_config


def get_supabase_client(config: Config | None = None) -> Client:
    resolved_config = config or load_config()
    return create_client(
        resolved_config.supabase_url,
        resolved_config.supabase_service_role_key,
    )

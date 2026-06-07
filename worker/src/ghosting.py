from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from .config import Config
from .stages import ACTIVE_STAGES


logger = logging.getLogger(__name__)


def mark_ghosted_applications(config: Config, supabase: Any) -> int:
    """Mark stale active applications as Ghosted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=config.ghosting_days)

    try:
        response = (
            supabase.table("applications")
            .select("id")
            .eq("kind", "application")
            .in_("stage", list(ACTIVE_STAGES))
            .eq("stage_locked", False)
            .lt("last_activity", cutoff.isoformat())
            .execute()
        )
        applications = _response_rows(response)
    except Exception:
        logger.exception("failed to load ghosting candidates")
        return 0

    changed = 0
    for application in applications:
        application_id = application.get("id")
        if not application_id:
            continue

        try:
            supabase.table("applications").update({"stage": "Ghosted"}).eq(
                "id",
                str(application_id),
            ).execute()
            changed += 1
        except Exception:
            logger.exception("failed to mark application %s as Ghosted", application_id)

    logger.info("ghosted %s applications", changed)
    return changed


def _response_rows(response: Any) -> list[Mapping[str, Any]]:
    data = getattr(response, "data", None)
    if data is None and isinstance(response, Mapping):
        data = response.get("data")
    return list(data or [])

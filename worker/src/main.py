from __future__ import annotations

import argparse
import logging
from datetime import datetime
from typing import Any, Mapping

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from .config import Config, load_config
from .gmail_client import build_gmail_service, fetch_message, list_candidate_message_ids
from .ghosting import mark_ghosted_applications
from .ingest import (
    IngestResult,
    backfill_application_posting_enrichment,
    ingest_message,
    preview_message,
)
from .supabase_client import get_supabase_client


logger = logging.getLogger(__name__)


def poll_job(config: Config) -> None:
    try:
        poll_once(config)
    except Exception:
        logger.exception("poll job failed")


def ghosting_job(config: Config) -> None:
    try:
        supabase = get_supabase_client(config)
        mark_ghosted_applications(config, supabase)
    except Exception:
        logger.exception("ghosting job failed")


def poll_once(
    config: Config,
    supabase: Any | None = None,
    dry_run: bool = False,
) -> list[IngestResult]:
    poll_started_at = datetime.now(config.timezone)
    resolved_supabase = supabase or get_supabase_client(config)
    last_poll_at = _read_last_poll_at(resolved_supabase)

    logger.info("starting Gmail poll")
    service = build_gmail_service(config)
    message_ids = list_candidate_message_ids(service, config, last_poll_at)
    logger.info("found %s Gmail message candidates", len(message_ids))

    results: list[IngestResult] = []
    had_failures = False
    for message_id in message_ids:
        try:
            message = fetch_message(service, config, message_id)
            if not message:
                had_failures = True
                continue

            if dry_run:
                result = preview_message(message, config, resolved_supabase)
                print(_format_dry_run_line(message, result))
            else:
                result = ingest_message(message, config, resolved_supabase)

            results.append(result)
            if result.action == "failed":
                had_failures = True
        except Exception:
            had_failures = True
            logger.exception("message processing failed for %s", message_id)

    if not dry_run:
        filled_count = backfill_application_posting_enrichment(resolved_supabase)
        logger.info("backfilled posting data on %s applications", filled_count)

    if not dry_run and not had_failures:
        _update_last_poll_at(resolved_supabase, poll_started_at)
        logger.info("Gmail poll finished")
    elif not dry_run:
        logger.warning("Gmail poll finished with failures, sync state was not advanced")
    else:
        logger.info("Gmail dry run finished")

    return results


def build_scheduler(config: Config) -> BlockingScheduler:
    scheduler = BlockingScheduler(timezone=config.timezone)
    now = datetime.now(config.timezone)

    scheduler.add_job(
        poll_job,
        trigger=IntervalTrigger(minutes=config.gmail_poll_interval_minutes),
        args=[config],
        id="gmail-poll",
        replace_existing=True,
        next_run_time=now,
    )
    scheduler.add_job(
        ghosting_job,
        trigger=CronTrigger(hour=2, minute=0, timezone=config.timezone),
        args=[config],
        id="nightly-ghosting",
        replace_existing=True,
    )

    return scheduler


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    args = _parse_args()
    config = load_config()

    if args.once or args.dry_run:
        poll_once(config, dry_run=args.dry_run)
        return

    scheduler = build_scheduler(config)

    logger.info("worker started")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("worker stopped")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Job tracker worker")
    parser.add_argument("--once", action="store_true", help="Run one poll and exit.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Classify and match without writing to Supabase.",
    )
    return parser.parse_args()


def _read_last_poll_at(supabase: Any) -> str | None:
    try:
        response = (
            supabase.table("sync_state")
            .select("last_poll_at")
            .eq("id", 1)
            .limit(1)
            .execute()
        )
        rows = _response_rows(response)
        if not rows:
            return None
        value = rows[0].get("last_poll_at")
        return value if isinstance(value, str) else None
    except Exception:
        logger.exception("failed to read sync state")
        raise


def _update_last_poll_at(supabase: Any, poll_started_at: datetime) -> None:
    try:
        now = datetime.now(poll_started_at.tzinfo)
        supabase.table("sync_state").update(
            {
                "last_poll_at": poll_started_at.isoformat(),
                "updated_at": now.isoformat(),
            }
        ).eq("id", 1).execute()
    except Exception:
        logger.exception("failed to update sync state")
        raise


def _format_dry_run_line(message: Mapping[str, Any], result: IngestResult) -> str:
    subject = str(message.get("subject") or "").replace("\n", " ").strip()
    from_address = str(message.get("from_address") or "").replace("\n", " ").strip()
    confidence = "" if result.confidence is None else f"{result.confidence:.2f}"
    category = result.category or "unknown"
    action = _format_route_action(result)

    return (
        f"from: {from_address} | "
        f"subject: {subject} | "
        f"category: {category} | "
        f"stage: {result.detected_stage} | "
        f"confidence: {confidence} | "
        f"action: {action}"
    )


def _format_route_action(result: IngestResult) -> str:
    if result.action == "skipped_alert":
        return "skipped by pre-filter"
    if result.action == "duplicate":
        return "already processed"
    if result.action == "application_event_matched":
        return f"application_event matched {result.matched_application_id}"
    if result.action == "application_event_create_orphan":
        return "application_event create orphan"
    if result.action == "application_event_low_confidence":
        return "application_event low confidence"
    if result.action == "recruiter_outreach_captured":
        if result.matched_application_id and not result.orphan_created:
            return f"recruiter_outreach matched {result.matched_application_id}"
        return "recruiter_outreach captured"
    if result.action == "ignored_job_alert":
        return "job_alert ignored"
    if result.action == "ignored_other":
        return "other ignored"
    return result.action


def _response_rows(response: Any) -> list[Mapping[str, Any]]:
    data = getattr(response, "data", None)
    if data is None and isinstance(response, Mapping):
        data = response.get("data")
    return list(data or [])


if __name__ == "__main__":
    main()

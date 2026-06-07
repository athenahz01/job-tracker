from __future__ import annotations

import base64
import logging
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .config import Config


logger = logging.getLogger(__name__)

GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
GMAIL_READONLY_SCOPES = [GMAIL_READONLY_SCOPE]
GMAIL_LOOKBACK_OVERLAP_MINUTES = 5
MAX_BODY_CHARS = 6000
MAX_SNIPPET_CHARS = 500


def build_gmail_service(config: Config) -> Any:
    """Build an authorized Gmail API service for the configured inbox."""
    credentials = Credentials(
        token=None,
        refresh_token=config.gmail_oauth_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=config.gmail_oauth_client_id,
        client_secret=config.gmail_oauth_client_secret,
        scopes=GMAIL_READONLY_SCOPES,
    )

    try:
        credentials.refresh(Request())
        return build("gmail", "v1", credentials=credentials, cache_discovery=False)
    except Exception as error:
        logger.exception("failed to build Gmail service")
        raise RuntimeError("Could not build Gmail service.") from error


def list_candidate_message_ids(
    service: Any,
    config: Config,
    last_poll_at: datetime | str | None,
) -> list[str]:
    """List candidate Gmail message ids, including spam and trash."""
    message_ids: list[str] = []
    page_token: str | None = None
    query = _build_after_query(last_poll_at)

    while True:
        params: dict[str, Any] = {
            "userId": config.gmail_user_email,
            "includeSpamTrash": True,
        }
        if query:
            params["q"] = query
        if page_token:
            params["pageToken"] = page_token

        try:
            response = service.users().messages().list(**params).execute()
        except HttpError as error:
            logger.exception("failed to list Gmail messages")
            raise RuntimeError("Could not list Gmail messages.") from error
        except Exception as error:
            logger.exception("failed to list Gmail messages")
            raise RuntimeError("Could not list Gmail messages.") from error

        for message in response.get("messages", []):
            message_id = message.get("id")
            if message_id:
                message_ids.append(message_id)

        page_token = response.get("nextPageToken")
        if not page_token:
            return message_ids


def fetch_message(service: Any, config: Config, message_id: str) -> dict[str, Any] | None:
    """Fetch one Gmail message and return fields used by ingestion."""
    try:
        message = (
            service.users()
            .messages()
            .get(userId=config.gmail_user_email, id=message_id, format="full")
            .execute()
        )
    except HttpError:
        logger.exception("failed to fetch Gmail message %s", message_id)
        return None
    except Exception:
        logger.exception("failed to fetch Gmail message %s", message_id)
        return None

    payload = message.get("payload") or {}
    headers = _headers_by_name(payload.get("headers", []))
    body = _extract_plain_text(payload).strip()
    snippet = (message.get("snippet") or "").strip()
    text_for_classification = (body or snippet)[:MAX_BODY_CHARS]

    return {
        "gmail_message_id": message.get("id") or message_id,
        "gmail_thread_id": message.get("threadId"),
        "from_address": headers.get("from"),
        "subject": headers.get("subject"),
        "received_at": _internal_date_to_iso(message.get("internalDate")),
        "gmail_labels": message.get("labelIds") or [],
        "body": text_for_classification,
        "raw_snippet": (snippet or text_for_classification)[:MAX_SNIPPET_CHARS],
    }


def fetch_recent_messages(
    config: Config,
    last_poll_at: datetime | str | None = None,
) -> list[dict[str, Any]]:
    """Fetch recent messages for callers that want the full phase 1 flow."""
    service = build_gmail_service(config)
    message_ids = list_candidate_message_ids(service, config, last_poll_at)
    messages: list[dict[str, Any]] = []

    for message_id in message_ids:
        message = fetch_message(service, config, message_id)
        if message:
            messages.append(message)

    return messages


def _build_after_query(last_poll_at: datetime | str | None) -> str | None:
    parsed = _coerce_datetime(last_poll_at)
    if not parsed:
        return None

    window_start = parsed - timedelta(minutes=GMAIL_LOOKBACK_OVERLAP_MINUTES)
    return f"after:{int(window_start.timestamp())}"


def _coerce_datetime(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            logger.warning("could not parse last poll timestamp: %s", value)
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def _headers_by_name(headers: list[dict[str, str]]) -> dict[str, str]:
    values: dict[str, str] = {}
    for header in headers:
        name = (header.get("name") or "").lower()
        if name in {"from", "subject"}:
            values[name] = _decode_mime_header(header.get("value") or "")
    return values


def _decode_mime_header(value: str) -> str:
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _extract_plain_text(payload: dict[str, Any]) -> str:
    texts: list[str] = []
    _walk_plain_text(payload, texts)
    return "\n\n".join(text for text in texts if text).strip()


def _walk_plain_text(part: dict[str, Any], texts: list[str]) -> None:
    mime_type = part.get("mimeType")
    body = part.get("body") or {}
    data = body.get("data")

    if mime_type == "text/plain" and data:
        texts.append(_decode_body(data))

    for child in part.get("parts") or []:
        _walk_plain_text(child, texts)


def _decode_body(data: str) -> str:
    padding = "=" * ((4 - len(data) % 4) % 4)
    try:
        return base64.urlsafe_b64decode(f"{data}{padding}").decode("utf-8", "replace")
    except Exception:
        logger.warning("could not decode Gmail message body")
        return ""


def _internal_date_to_iso(value: str | None) -> str | None:
    if not value:
        return None
    try:
        received_at = datetime.fromtimestamp(int(value) / 1000, timezone.utc)
    except ValueError:
        logger.warning("could not parse Gmail internal date: %s", value)
        return None

    return received_at.isoformat()

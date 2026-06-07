from __future__ import annotations

import argparse
import os

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow


GMAIL_READONLY_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def main() -> None:
    load_dotenv()
    args = _parse_args()

    if args.client_secrets:
        flow = InstalledAppFlow.from_client_secrets_file(
            args.client_secrets,
            scopes=GMAIL_READONLY_SCOPES,
        )
    else:
        client_id = os.getenv("GMAIL_OAUTH_CLIENT_ID")
        client_secret = os.getenv("GMAIL_OAUTH_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise RuntimeError(
                "Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET, "
                "or pass a client secrets JSON file path."
            )
        flow = InstalledAppFlow.from_client_config(
            {
                "installed": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost"],
                }
            },
            scopes=GMAIL_READONLY_SCOPES,
        )

    credentials = flow.run_local_server(
        port=0,
        prompt="consent",
        access_type="offline",
    )

    if not credentials.refresh_token:
        raise RuntimeError("No refresh token returned. Revoke access and try again.")

    print(credentials.refresh_token)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print a Gmail readonly OAuth refresh token."
    )
    parser.add_argument(
        "client_secrets",
        nargs="?",
        help="Optional local OAuth client secrets JSON path.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    main()

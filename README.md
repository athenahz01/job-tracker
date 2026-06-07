# Job Tracker

Personal job application tracker for one Gmail inbox. The web app accepts extension-created applications, and the worker polls Gmail, classifies messages, matches them to applications, and updates stages.

## Setup

```bash
git clone https://github.com/athenahz01/job-tracker.git
cd job-tracker
```

Copy the example env files and fill the values locally. Real values stay out of git.

## Supabase

Apply `supabase/migrations/0001_init.sql` to a fresh Supabase project. It creates the stage enum, application and email event tables, sync state row, indexes, and row level security.

Then apply `supabase/migrations/0002_categories.sql`. It adds application kinds and email categories so recruiter outreach can stay separate from the application board.

## Web

```bash
cd web
npm install
npm run dev
```

The application intake route is `POST /api/applications`. Send the shared secret in the `x-extension-api-secret` header.

```json
{
  "company": "Acme Inc",
  "role": "Analyst",
  "url": "https://example.com/job",
  "source": "extension"
}
```

Check liveness and Supabase connectivity at `GET /api/health`.

## Gmail OAuth

Use the readonly scope only: `https://www.googleapis.com/auth/gmail.readonly`.

1. Create a Google Cloud project.
2. Enable the Gmail API.
3. Configure the OAuth consent screen in Testing mode.
4. Add `zhengathenahuo@gmail.com` as a test user.
5. Create an OAuth client with application type Desktop app.
6. Put `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` in `worker/.env`, or keep the downloaded client secrets JSON locally outside the repo.
7. Run the token helper.

```bash
cd worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts/get_refresh_token.py
```

With a local client secrets file:

```bash
python scripts/get_refresh_token.py C:\path\to\client_secret.json
```

Paste the printed value into `GMAIL_OAUTH_REFRESH_TOKEN` in the worker env. Do not commit that value. An OAuth app left in Testing mode expires refresh tokens after about 7 days, so you may need to rerun the script periodically until the app is published.

## Worker

```bash
cd worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m src.main
```

Run one poll cycle and exit:

```bash
python -m src.main --once
```

Audit real mail without writing to Supabase:

```bash
python -m src.main --dry-run
```

The dry run prints the category and routing decision for each message. `application_event` is the only category that creates or advances a board application. `recruiter_outreach` is captured as a separate kind. `job_alert` and `other` are ignored.

Known automated job-board alert senders are skipped before classification. Add more without code changes by setting `EXTRA_ALERT_SENDERS` to a comma separated list of exact email addresses or sender domains.

Run tests:

```bash
pytest
```

## Deploy

Vercel root directory: `web`

Railway root directory: `worker`

Phase 2 builds the dashboard UI. Phase 3 builds the Chrome extension.

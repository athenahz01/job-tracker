alter table applications add column requirement_matches    jsonb;
alter table applications add column requirements_scored_at timestamptz;
alter table applications add column ai_tailored_resume     text;
alter table applications add column tailored_resume_at     timestamptz;

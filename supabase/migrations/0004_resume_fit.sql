create table profile (
  id          int primary key default 1,
  resume_text text,
  updated_at  timestamptz not null default now()
);

insert into profile (id) values (1) on conflict do nothing;

alter table profile enable row level security;

alter table applications add column fit_score           int;
alter table applications add column fit_summary         text;
alter table applications add column missing_keywords    text[] not null default '{}';
alter table applications add column scored_at           timestamptz;
alter table applications add column ai_tailored_bullets text[] not null default '{}';
alter table applications add column ai_cover_letter     text;
alter table applications add column tailored_at         timestamptz;

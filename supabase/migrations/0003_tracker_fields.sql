alter table applications add column next_action     text;
alter table applications add column follow_up_on    date;
alter table applications add column salary          text;
alter table applications add column location        text;
alter table applications add column deadline        date;
alter table applications add column priority        text;
alter table applications add column tags            text[] not null default '{}';
alter table applications add column resume_version  text;

create table contacts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  company        text,
  title          text,
  email          text,
  linkedin_url   text,
  relationship   text,
  application_id uuid references applications(id),
  notes          text,
  last_contacted date,
  next_follow_up date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on applications (follow_up_on);
create index on applications using gin (tags);
create index on contacts (application_id);
create index on contacts (next_follow_up);

alter table contacts enable row level security;

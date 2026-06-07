create type stage as enum (
  'Saved','Applied','Assessment','Phone Screen',
  'Interview','Final','Offer','Rejected','Ghosted'
);

create table applications (
  id                 uuid primary key default gen_random_uuid(),
  company            text not null,
  normalized_company text not null,
  company_domain     text,
  role               text,
  source             text,
  url                text,
  stage              stage not null default 'Applied',
  is_orphan          boolean not null default false,
  merged_into_id     uuid references applications(id),
  stage_locked       boolean not null default false,
  notes              text,
  first_seen         timestamptz not null default now(),
  last_activity      timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table email_events (
  id               uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id  text,
  application_id    uuid references applications(id),
  is_job_related   boolean,
  detected_stage   stage,
  confidence       numeric,
  company          text,
  role             text,
  from_address     text,
  subject          text,
  summary          text,
  raw_snippet      text,
  gmail_labels     text[],
  advanced_stage   boolean default false,
  received_at      timestamptz,
  processed_at     timestamptz not null default now()
);

create table sync_state (
  id              int primary key default 1,
  last_poll_at    timestamptz,
  last_history_id text,
  updated_at      timestamptz not null default now()
);

insert into sync_state (id) values (1) on conflict do nothing;

create index on email_events (application_id);
create index on applications (normalized_company);
create index on applications (company_domain);
create index on applications (stage);
create index on applications (last_activity);

alter table applications enable row level security;
alter table email_events enable row level security;
alter table sync_state enable row level security;

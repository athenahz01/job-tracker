create table job_postings (
  id                 uuid primary key default gen_random_uuid(),
  url                text,
  company            text,
  normalized_company text,
  role               text,
  salary             text,
  location           text,
  tags               text[] not null default '{}',
  seen_at            timestamptz not null default now()
);

create unique index on job_postings (url);
create index on job_postings (normalized_company);
create index on job_postings (seen_at);

alter table job_postings enable row level security;

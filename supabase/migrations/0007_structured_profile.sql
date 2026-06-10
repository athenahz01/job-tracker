alter table profile add column first_name        text;
alter table profile add column last_name         text;
alter table profile add column city              text;
alter table profile add column state             text;
alter table profile add column country           text;
alter table profile add column postal_code       text;
alter table profile add column skills            text[] not null default '{}';

alter table profile add column work_authorized   text;
alter table profile add column gender             text;
alter table profile add column race_ethnicity     text;
alter table profile add column hispanic_latino    text;
alter table profile add column veteran_status     text;
alter table profile add column disability_status  text;
alter table profile add column lgbtq_status       text;

create table education (
  id              uuid primary key default gen_random_uuid(),
  school          text,
  degree          text,
  field_of_study  text,
  start_date      text,
  end_date        text,
  gpa             text,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table work_experience (
  id          uuid primary key default gen_random_uuid(),
  company     text,
  title       text,
  location    text,
  start_date  text,
  end_date    text,
  is_current  boolean not null default false,
  description text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on education (sort_order);
create index on work_experience (sort_order);

alter table education enable row level security;
alter table work_experience enable row level security;

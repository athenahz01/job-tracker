alter table profile add column full_name           text;
alter table profile add column email               text;
alter table profile add column phone               text;
alter table profile add column location            text;
alter table profile add column linkedin_url        text;
alter table profile add column github_url          text;
alter table profile add column portfolio_url       text;
alter table profile add column website_url         text;
alter table profile add column work_authorization  text;
alter table profile add column requires_sponsorship boolean;
alter table profile add column years_experience    text;
alter table profile add column current_title       text;

create table screener_answers (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on screener_answers (question);

alter table screener_answers enable row level security;

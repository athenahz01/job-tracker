alter table contacts add column school          text;
alter table contacts add column past_companies  text[] not null default '{}';
alter table contacts add column outreach_stage  text;

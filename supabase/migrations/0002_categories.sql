alter table applications
  add column kind text not null default 'application';

alter table email_events
  add column category text;

create index on applications (kind);

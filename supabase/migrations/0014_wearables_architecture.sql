-- Raag — V2: real wearables data schema (architecture ready, no live
-- aggregator account yet)
--
-- The user deliberately doesn't have a Vital/Terra account yet (cost),
-- but asked for the real architecture to be ready so flipping it on
-- later is just "add the account + fill in the webhook payload mapping",
-- not a rebuild. This migration is the provider-agnostic part: real
-- tables for sleep/activity data (getSleep/getActivity currently return
-- a hardcoded [] regardless of what's in the DB — fixed alongside this
-- in src/lib/api/supabase.ts), and connection-state tracking honest
-- enough to show a real sync error instead of a fake "Live" badge.
--
-- What's NOT here, on purpose: any Vital- or Terra-specific webhook
-- payload parsing. Their JSON shapes differ and neither has been chosen
-- yet — writing that now would mean guessing at an untested shape.
-- supabase/functions/wearable-webhook/index.ts has the provider-agnostic
-- scaffolding (secret verification, normalized upsert) with a clearly
-- marked spot for that provider-specific mapping once an account exists.

alter table wearable_connections add column if not exists last_sync_status text
  check (last_sync_status in ('ok', 'error')) default null;
alter table wearable_connections add column if not exists last_sync_error text;

create table sleep_entries (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  provider text not null,
  date date not null,
  total_minutes integer not null,
  deep_minutes integer,
  rem_minutes integer,
  light_minutes integer,
  score integer,
  external_id text,
  created_at timestamptz not null default now(),
  unique (subject_id, provider, date)
);

create table activity_entries (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  provider text not null,
  date date not null,
  steps integer,
  calories_burned integer,
  active_minutes integer,
  external_id text,
  created_at timestamptz not null default now(),
  unique (subject_id, provider, date)
);

alter table sleep_entries enable row level security;
alter table activity_entries enable row level security;

create policy sleep_entries_select on sleep_entries for select using (can_view_subject(subject_id));
create policy sleep_entries_write on sleep_entries for insert with check (can_edit_subject(subject_id));
create policy sleep_entries_update on sleep_entries for update using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));
create policy sleep_entries_delete on sleep_entries for delete using (can_edit_subject(subject_id));

create policy activity_entries_select on activity_entries for select using (can_view_subject(subject_id));
create policy activity_entries_write on activity_entries for insert with check (can_edit_subject(subject_id));
create policy activity_entries_update on activity_entries for update using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));
create policy activity_entries_delete on activity_entries for delete using (can_edit_subject(subject_id));

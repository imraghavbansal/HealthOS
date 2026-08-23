-- Raag — V2 stage 9: signed, expiring, scoped share links
--
-- A share link lets the owner hand a doctor/family member a URL that shows
-- a limited, read-only view of their data without that person needing a
-- Raag account. The token is server-generated (gen_random_bytes via
-- pgcrypto, already enabled in 0001_init.sql) — never client-chosen, so
-- it can't be guessed or replayed from a predictable seed. "Signed" here
-- means unguessable + validated server-side on every access (expiry,
-- revocation, scope), not a JWT — simpler and sufficient for a bearer-
-- token-style share link, matching how e.g. Google Drive share links work.
--
-- The public viewer has no Supabase session at all, so RLS can't grant it
-- anything — access instead goes entirely through the get-shared-record
-- Edge Function (service-role, validates token/expiry/scope itself, is
-- the only writer of share_link_access_log). Direct table RLS below is
-- for the *owner's* management UI only (list/create/revoke their own
-- links) and explicitly denies any anon/authenticated cross-subject read.

create table share_links (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  label text,
  scope text not null default 'summary' check (scope in ('summary', 'labs', 'medications', 'full')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index share_links_token_idx on share_links(token);
create index share_links_subject_idx on share_links(subject_id);

alter table share_links enable row level security;

create policy share_links_select on share_links for select using (can_view_subject(subject_id));
create policy share_links_insert on share_links for insert with check (can_edit_subject(subject_id) and created_by = auth.uid());
create policy share_links_update on share_links for update using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));
create policy share_links_delete on share_links for delete using (can_edit_subject(subject_id));

create table share_link_access_log (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references share_links(id) on delete cascade,
  accessed_at timestamptz not null default now(),
  user_agent text
);

create index share_link_access_log_link_idx on share_link_access_log(share_link_id);

alter table share_link_access_log enable row level security;

-- Owners can read the access log for their own links (join through
-- share_links, same can_view_subject check). Nobody gets insert/update/
-- delete via RLS — only the service-role Edge Function writes these.
create policy share_link_access_log_select on share_link_access_log for select using (
  exists (
    select 1 from share_links sl
    where sl.id = share_link_access_log.share_link_id
      and can_view_subject(sl.subject_id)
  )
);

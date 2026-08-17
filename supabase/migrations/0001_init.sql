-- Raag — core schema
-- Design doc: docs/PRODUCT-VISION.md, docs/HANDOFF.md
--
-- Key structural decision: clinical data hangs off a `health_subjects` row,
-- not a raw auth user id. A "subject" is a person with a health history —
-- either the account holder themself (kind='self', id = their own auth id)
-- or a dependent they manage (a child / aging parent without their own
-- login). This is what lets a household hold multiple independent health
-- histories under shared, revocable, per-person access grants instead of
-- flattening everyone's data behind one user_id.

create extension if not exists "vector";
create extension if not exists "pgcrypto";

-- ── households & access ──────────────────────────────────────────────────

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Family',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'adult' check (role in ('owner', 'adult', 'caregiver')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table health_subjects (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('self', 'dependent')),
  -- the adult account responsible for this subject: themself (kind=self)
  -- or the adult who manages a dependent's records (kind=dependent)
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references households(id) on delete set null,
  name text not null,
  date_of_birth date,
  sex text,
  relation text, -- e.g. "Child", "Parent" — only meaningful for dependents
  avatar_url text,
  created_at timestamptz not null default now()
);

-- only one kind='self' subject per user; unlimited kind='dependent' rows
create unique index health_subjects_one_self_per_user
  on health_subjects (owner_user_id)
  where kind = 'self';

-- who besides the owner can see/edit a subject's data, and how much
create table access_grants (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null default 'summary' check (scope in ('full', 'summary', 'specific')),
  categories text[], -- used when scope = 'specific', e.g. {medications, appointments}
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (subject_id, grantee_user_id)
);

-- read access: owner, or an active grant of any scope (category filtering
-- for 'specific' scope is enforced in the API layer for v1)
create or replace function can_view_subject(target_subject uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from health_subjects s
    where s.id = target_subject
      and (
        s.owner_user_id = auth.uid()
        or exists (
          select 1 from access_grants g
          where g.subject_id = s.id
            and g.grantee_user_id = auth.uid()
            and g.revoked_at is null
        )
      )
  );
$$;

-- write access: owner, or an active grant with scope = 'full'
create or replace function can_edit_subject(target_subject uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from health_subjects s
    where s.id = target_subject
      and (
        s.owner_user_id = auth.uid()
        or exists (
          select 1 from access_grants g
          where g.subject_id = s.id
            and g.grantee_user_id = auth.uid()
            and g.scope = 'full'
            and g.revoked_at is null
        )
      )
  );
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table health_subjects enable row level security;
alter table access_grants enable row level security;

create policy households_member_select on households for select
  using (exists (select 1 from household_members m where m.household_id = id and m.user_id = auth.uid()));
create policy households_owner_write on households for all
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy household_members_select on household_members for select
  using (user_id = auth.uid() or exists (
    select 1 from household_members m2
    where m2.household_id = household_members.household_id and m2.user_id = auth.uid()
  ));
create policy household_members_owner_write on household_members for all
  using (exists (
    select 1 from households h where h.id = household_id and h.created_by = auth.uid()
  ));

create policy health_subjects_select on health_subjects for select using (can_view_subject(id));
create policy health_subjects_owner_write on health_subjects for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy access_grants_visible_to_parties on access_grants for select
  using (grantee_user_id = auth.uid() or granted_by = auth.uid());
create policy access_grants_owner_write on access_grants for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

-- ── profile & per-account settings ───────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  timezone text not null default 'UTC',
  plan text not null default 'free' check (plan in ('free', 'pro', 'family', 'clinic')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table consent_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_deidentified boolean not null default false,
  ai_use_family_history boolean not null default true,
  share_with_pcp boolean not null default false,
  pcp_contact text,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table consent_settings enable row level security;
create policy profiles_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy consent_self on consent_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── subject-scoped clinical & lifestyle data ─────────────────────────────
-- every table below follows the same shape: subject_id + can_view/can_edit
-- policies. logged_by records which account actually made the entry
-- (relevant once a caregiver logs on a dependent's or shared subject's behalf).

create table lifestyle_profile (
  subject_id uuid primary key references health_subjects(id) on delete cascade,
  alcohol text,
  smoking text,
  exercise text,
  diet text,
  updated_at timestamptz not null default now()
);

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_kb integer not null default 0,
  document_type text not null default 'Other' check (document_type in ('Labs', 'Imaging', 'Rx', 'Visit', 'Vax', 'Other')),
  title text not null,
  provider text,
  document_date date,
  summary text,
  ocr_status text not null default 'pending' check (ocr_status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  ocr_error text,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create table conditions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'resolved', 'chronic')),
  diagnosed_at date,
  diagnosed_by text,
  notes text,
  source_document_id uuid references source_documents(id) on delete set null,
  extraction_confidence numeric,
  verified_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

create table lab_markers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  name text not null,
  value numeric not null,
  unit text not null,
  range_low numeric,
  range_high numeric,
  collected_at timestamptz not null,
  source_document_id uuid references source_documents(id) on delete set null,
  extraction_confidence numeric,
  verified_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

create table medications (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  name text not null,
  dose text,
  schedule text,
  type text not null default 'Supplement' check (type in ('Supplement', 'Prescription')),
  refills_left integer,
  interactions text[],
  active boolean not null default true,
  source_document_id uuid references source_documents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table dose_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  subject_id uuid not null references health_subjects(id) on delete cascade,
  taken_at timestamptz not null default now(),
  skipped boolean not null default false,
  logged_by uuid not null references auth.users(id) default auth.uid()
);

create table vitals (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  kind text not null check (kind in ('weight', 'bloodPressure', 'restingHr', 'spo2', 'temperature', 'glucose', 'mood')),
  value numeric not null,
  secondary numeric,
  unit text not null,
  recorded_at timestamptz not null default now(),
  note text,
  source text not null default 'manual' check (source in ('manual', 'device', 'clinic')),
  logged_by uuid not null references auth.users(id) default auth.uid()
);

create table symptoms (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  label text not null,
  severity integer not null check (severity between 1 and 10),
  body_area text,
  started_at timestamptz not null default now(),
  tags text[],
  note text,
  logged_by uuid not null references auth.users(id) default auth.uid()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  title text not null,
  provider text,
  specialty text,
  start_at timestamptz not null,
  duration_min integer not null default 30,
  location text,
  mode text not null default 'in-person' check (mode in ('in-person', 'video', 'phone')),
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'cancelled')),
  prep_notes text[],
  created_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  title text not null,
  category text not null,
  target text,
  due_date date,
  progress numeric not null default 0,
  streak integer not null default 0,
  created_at timestamptz not null default now()
);

create table nutrition_targets (
  subject_id uuid primary key references health_subjects(id) on delete cascade,
  kcal integer not null default 2000,
  protein integer not null default 100,
  carbs integer not null default 250,
  fat integer not null default 70,
  water_ml integer not null default 2500
);

create table nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  meal text not null check (meal in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  name text not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  logged_at timestamptz not null default now()
);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  ml integer not null,
  logged_at timestamptz not null default now()
);

-- ancestry/genetic risk info about relatives who are NOT Raag subjects —
-- distinct from health_subjects/access_grants (see docs/PRODUCT-VISION.md)
create table family_history_entries (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  relation text not null,
  age integer,
  conditions text[],
  created_at timestamptz not null default now()
);

create table wearable_connections (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  provider text not null,
  external_user_id text,
  connected boolean not null default false,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subject_id, provider)
);

create table insights (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  source_refs jsonb,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'system' check (kind in ('reminder', 'result', 'insight', 'system')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- AI conversation + retrieval memory
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  user_id uuid not null references auth.users(id), -- who's chatting (owner or a grantee)
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create table record_embeddings (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references health_subjects(id) on delete cascade,
  source_table text not null,
  source_id uuid not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index on record_embeddings using ivfflat (embedding vector_cosine_ops);

-- append-only audit trail — required before real PII per docs/BUSINESS-MODEL.md
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  subject_id uuid references health_subjects(id),
  action text not null,
  resource text not null,
  resource_id uuid,
  created_at timestamptz not null default now()
);

-- ── RLS: one pattern applied to every subject-scoped table above ────────

do $$
declare
  t text;
  subject_tables text[] := array[
    'lifestyle_profile', 'source_documents', 'conditions', 'lab_markers',
    'medications', 'vitals', 'symptoms', 'appointments', 'goals',
    'nutrition_targets', 'nutrition_entries', 'water_logs',
    'family_history_entries', 'wearable_connections', 'insights',
    'chat_messages', 'record_embeddings'
  ];
begin
  foreach t in array subject_tables loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_select on %I for select using (can_view_subject(subject_id))',
      t, t
    );
    execute format(
      'create policy %I_write on %I for insert with check (can_edit_subject(subject_id))',
      t, t
    );
    execute format(
      'create policy %I_update on %I for update using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id))',
      t, t
    );
    execute format(
      'create policy %I_delete on %I for delete using (can_edit_subject(subject_id))',
      t, t
    );
  end loop;
end $$;

-- dose_logs is keyed by medication_id but also carries subject_id for RLS
alter table dose_logs enable row level security;
create policy dose_logs_select on dose_logs for select using (can_view_subject(subject_id));
create policy dose_logs_write on dose_logs for insert with check (can_edit_subject(subject_id));

alter table notifications enable row level security;
create policy notifications_self on notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table audit_log enable row level security;
create policy audit_log_read on audit_log for select using (actor_user_id = auth.uid());
create policy audit_log_insert_only on audit_log for insert with check (actor_user_id = auth.uid());
-- no update/delete policy at all: append-only by construction

-- ── bootstrap a new account: profile, household, self subject, defaults ──

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_household_id uuid;
  display_name text := coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));
begin
  insert into profiles (id, name, email) values (new.id, display_name, new.email);

  insert into households (name, created_by) values (display_name || '''s household', new.id)
    returning id into new_household_id;
  insert into household_members (household_id, user_id, role) values (new_household_id, new.id, 'owner');

  insert into health_subjects (id, kind, owner_user_id, household_id, name)
    values (new.id, 'self', new.id, new_household_id, display_name);

  insert into lifestyle_profile (subject_id) values (new.id);
  insert into nutrition_targets (subject_id) values (new.id);
  insert into consent_settings (user_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

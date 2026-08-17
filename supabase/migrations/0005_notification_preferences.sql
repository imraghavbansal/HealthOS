-- Orvana — notification preferences
--
-- Real persistence for the Settings → Notifications toggles. Actual
-- delivery (push notifications) doesn't exist yet — that's the Capacitor +
-- scheduled-function work in the roadmap's V2 phase — so these currently
-- persist intent without anything acting on it yet. Still real, not faked.

create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  medication_reminders boolean not null default true,
  weekly_brief boolean not null default true,
  new_lab_results boolean not null default true,
  trend_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;
create policy notification_preferences_self on notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- backfill for accounts created before this migration existed — the
-- bootstrap trigger below only fires on new signups
insert into notification_preferences (user_id)
select id from auth.users
where id not in (select user_id from notification_preferences)
on conflict (user_id) do nothing;

-- extend the account bootstrap trigger to seed this table too
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
  insert into notification_preferences (user_id) values (new.id);

  return new;
end;
$$;

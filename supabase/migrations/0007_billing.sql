-- Raag — billing (Razorpay)
--
-- profiles.plan (already existed) stays the single field the rest of the
-- app reads — no client code changes needed. This table holds the
-- Razorpay-specific subscription metadata behind it. Critically: no
-- insert/update/delete policy exists here for regular users at all — only
-- the razorpay-webhook Edge Function (service role) ever writes to this
-- table, driven exclusively by Razorpay's own signed webhook events.
-- "Never trust a client-side plan flag" (per the master build spec) is
-- enforced structurally, not by convention.

create table billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  status text not null default 'none' check (status in (
    'none', 'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'
  )),
  plan text not null default 'free' check (plan in ('free', 'pro', 'family', 'clinic')),
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table billing enable row level security;
create policy billing_select_self on billing for select using (user_id = auth.uid());

-- backfill + extend the bootstrap trigger to seed this table too
insert into billing (user_id)
select id from auth.users
where id not in (select user_id from billing)
on conflict (user_id) do nothing;

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
  insert into billing (user_id) values (new.id);

  return new;
end;
$$;

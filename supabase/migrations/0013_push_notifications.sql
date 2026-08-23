-- Raag — V2: push notifications + real notification writes
--
-- Two gaps closed together, since push is meaningless without something
-- to notify about: (1) nothing has ever written to `notifications` —
-- the in-app bell has been reading a table nobody inserts into since
-- 0001_init.sql; (2) no push infrastructure existed at all. Both fixed
-- here: generate_insights() (0009) now also writes a real notification
-- (respecting the user's existing notification_preferences toggles) for
-- each newly-created insight, and every notification insert fires a
-- fire-and-forget push via pg_net, same established pattern as
-- 0006_ingestion_queue.sql's background dispatch.
--
-- Medication *reminder* pushes (as opposed to adherence-drop insights)
-- are NOT included — medications.schedule is free text, not a structured
-- time, so there's nothing to reliably schedule against yet. Honest gap,
-- not silently dropped: flagged in CLAUDE.md.
--
-- SETUP REQUIRED:
--   1. Generate a VAPID key pair (already done for you — see the chat
--      message this migration shipped with for the actual keys).
--   2. In send-push's Edge Function secrets, add:
--        VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@yourdomain)
--   3. Add VITE_VAPID_PUBLIC_KEY to your .env (client-side, same value as
--      VAPID_PUBLIC_KEY above — it's public by design) and to Vercel's
--      environment variables.
--   4. Pick any long random string as your push-trigger secret (this is
--      NOT your service-role key or DB password — Raag can generate one
--      for you if you'd rather not). Set it in TWO places with the SAME
--      value: (a) the vault.create_secret call at the bottom of this
--      file, and (b) send-push's Edge Function secrets as
--      PUSH_TRIGGER_SECRET — same two-places-same-value pattern as
--      INTERNAL_QUEUE_SECRET in 0006_ingestion_queue.sql.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
create policy push_subscriptions_self on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Resolves the subject's responsible adult (owner_user_id — same person
-- for kind='self', the managing adult for kind='dependent') and inserts
-- a real notification row for them. Kept as its own function rather than
-- inlined so both generate_insights() and any future writer share one
-- consistent path.
create or replace function notify_subject_owner(p_subject_id uuid, p_title text, p_body text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select owner_user_id into v_owner from health_subjects where id = p_subject_id;
  if v_owner is null then
    return;
  end if;
  insert into notifications (user_id, title, body, kind) values (v_owner, p_title, p_body, p_kind);
end;
$$;

-- ── extend generate_insights() to also write a real notification ───────
-- Identical to 0009's version except: each successful insight insert is
-- followed by notify_subject_owner(), gated by the matching
-- notification_preferences toggle so a user who turned off "trend
-- alerts" doesn't get notified about trend insights (they still see the
-- insight itself in-app — this only gates the notification/push).
create or replace function generate_insights(p_subject_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_trend record;
  v_recent_avg numeric;
  v_baseline_avg numeric;
  v_recent_n int;
  v_baseline_n int;
  v_pct_change numeric;
  v_direction text;
  v_lab record;
  v_med record;
  v_taken int;
  v_total int;
  v_adherence numeric;
  v_owner uuid;
  v_prefs record;
begin
  if not can_edit_subject(p_subject_id) then
    raise exception 'not authorized for subject %', p_subject_id;
  end if;

  select owner_user_id into v_owner from health_subjects where id = p_subject_id;
  select * into v_prefs from notification_preferences where user_id = v_owner;

  -- ── vital trend drift ──────────────────────────────────────────────
  for v_trend in
    select * from (values
      ('weight', 'Weight', '', 5),
      ('restingHr', 'Resting heart rate', 'bpm', 10),
      ('glucose', 'Glucose', '', 15),
      ('bloodPressure', 'Blood pressure (systolic)', 'mmHg', 10)
    ) as t(kind, label, unit, threshold)
  loop
    select count(*) into v_recent_n from vitals
      where subject_id = p_subject_id and kind = v_trend.kind and recorded_at >= now() - interval '90 days';
    continue when v_recent_n < 4;

    select avg(value), count(*) into v_recent_avg, v_recent_n from (
      select value from vitals where subject_id = p_subject_id and kind = v_trend.kind
        and recorded_at >= now() - interval '30 days'
        order by recorded_at desc limit 3
    ) recent;

    select avg(value), count(*) into v_baseline_avg, v_baseline_n from (
      select value from vitals where subject_id = p_subject_id and kind = v_trend.kind
        and recorded_at < now() - interval '30 days' and recorded_at >= now() - interval '90 days'
        order by recorded_at desc limit 3
    ) baseline;

    continue when v_recent_avg is null or v_baseline_avg is null or v_baseline_avg = 0 or v_baseline_n < 2;

    v_pct_change := round(((v_recent_avg - v_baseline_avg) / v_baseline_avg) * 100, 1);
    continue when abs(v_pct_change) < v_trend.threshold::numeric;

    v_direction := case when v_pct_change > 0 then 'up' else 'down' end;

    if not exists (
      select 1 from insights
      where subject_id = p_subject_id and dismissed = false
        and created_at >= now() - interval '14 days'
        and title = v_trend.label || ' is trending ' || v_direction
    ) then
      insert into insights (subject_id, title, body, severity, source_refs)
      values (
        p_subject_id,
        v_trend.label || ' is trending ' || v_direction,
        format(
          'Your %s %s %s%% over the last ~30 days (recent average %s%s vs. prior average %s%s). Based on your own logged readings — not a diagnosis.',
          lower(v_trend.label), case when v_pct_change > 0 then 'rose' else 'fell' end, abs(v_pct_change),
          round(v_recent_avg, 1), case when v_trend.unit = '' then '' else ' ' || v_trend.unit end,
          round(v_baseline_avg, 1), case when v_trend.unit = '' then '' else ' ' || v_trend.unit end
        ),
        'warning',
        jsonb_build_object('kind', 'vital_trend', 'vital_kind', v_trend.kind)
      );
      if v_prefs is null or v_prefs.trend_alerts then
        perform notify_subject_owner(p_subject_id, v_trend.label || ' is trending ' || v_direction, 'Open Raag to see the details.', 'insight');
      end if;
    end if;
  end loop;

  -- ── out-of-range lab markers ───────────────────────────────────────
  for v_lab in
    select id, name, value, unit, range_low, range_high, collected_at
    from lab_markers
    where subject_id = p_subject_id
      and collected_at >= now() - interval '30 days'
      and range_low is not null and range_high is not null
      and (value < range_low or value > range_high)
  loop
    if not exists (
      select 1 from insights
      where subject_id = p_subject_id
        and source_refs @> jsonb_build_object('lab_marker_id', v_lab.id)
    ) then
      insert into insights (subject_id, title, body, severity, source_refs)
      values (
        p_subject_id,
        v_lab.name || ' is outside the typical range',
        format(
          'Your %s came back at %s %s (typical range %s–%s %s), from your %s reading. Worth flagging to your doctor — this is informational, not a diagnosis.',
          v_lab.name, v_lab.value, v_lab.unit, v_lab.range_low, v_lab.range_high, v_lab.unit,
          to_char(v_lab.collected_at, 'DD Mon YYYY')
        ),
        'warning',
        jsonb_build_object('kind', 'lab_out_of_range', 'lab_marker_id', v_lab.id)
      );
      if v_prefs is null or v_prefs.new_lab_results then
        perform notify_subject_owner(p_subject_id, v_lab.name || ' is outside the typical range', 'A recent lab result needs a look.', 'result');
      end if;
    end if;
  end loop;

  -- ── medication adherence drop ──────────────────────────────────────
  for v_med in select id, name from medications where subject_id = p_subject_id and active = true
  loop
    select count(*) filter (where not skipped), count(*) into v_taken, v_total
      from dose_logs where medication_id = v_med.id and taken_at >= now() - interval '30 days';
    continue when v_total < 4;

    v_adherence := round((v_taken::numeric / v_total) * 100);
    continue when v_adherence >= 70;

    if not exists (
      select 1 from insights
      where subject_id = p_subject_id and dismissed = false
        and created_at >= now() - interval '14 days'
        and source_refs @> jsonb_build_object('medication_id', v_med.id)
    ) then
      insert into insights (subject_id, title, body, severity, source_refs)
      values (
        p_subject_id,
        'Adherence to ' || v_med.name || ' has dropped',
        format(
          'You''ve taken %s%% of your logged %s doses in the last 30 days (%s of %s). Missed doses can affect how well it works — worth a look.',
          v_adherence, v_med.name, v_taken, v_total
        ),
        'warning',
        jsonb_build_object('kind', 'adherence_drop', 'medication_id', v_med.id)
      );
      if v_prefs is null or v_prefs.medication_reminders then
        perform notify_subject_owner(p_subject_id, 'Adherence to ' || v_med.name || ' has dropped', 'Open Raag to see the details.', 'reminder');
      end if;
    end if;
  end loop;
end;
$$;

-- ── dispatch a push whenever a notification is written ─────────────────
create or replace function dispatch_push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  push_secret text;
  anon_key text := 'sb_publishable_seNNpZK9_vnpCdRnHlC5KA_qyqzIGnZ'; -- public key, safe to embed
  function_url text := 'https://tntznncjqexgktuuadep.supabase.co/functions/v1/send-push';
begin
  select decrypted_secret into push_secret from vault.decrypted_secrets where name = 'push_trigger_secret';
  if push_secret is null then
    raise notice 'push_trigger_secret not set in Vault — skipping push dispatch';
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key,
      'x-internal-secret', push_secret
    ),
    body := jsonb_build_object('userId', new.user_id, 'title', new.title, 'body', new.body),
    timeout_milliseconds := 15000
  );
  return new;
end;
$$;

create trigger notifications_dispatch_push
  after insert on notifications
  for each row execute function dispatch_push_on_notification();

-- Run this once, with a value you generate yourself (any long random
-- string is fine — this is NOT your Supabase service-role key or DB
-- password, just a shared secret between this trigger and send-push):
-- select vault.create_secret('<your-push-trigger-secret>', 'push_trigger_secret');

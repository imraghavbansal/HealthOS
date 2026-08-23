-- Raag — V2 rule-based insights engine
--
-- Deterministic, not AI-generated: statistical trend detection over vitals
-- and lab markers, plus a medication-adherence check. No model call, no
-- Anthropic dependency, so this works today even with zero AI billing.
-- Runs as the calling user (security invoker, RLS-scoped) via
-- can_edit_subject — never security definer, never bypasses row ownership.
--
-- Called lazily from the client on every getInsights() read (see
-- src/lib/api/supabase.ts) rather than on a cron schedule: it's cheap
-- (a handful of aggregate queries over one subject), idempotent (dedupes
-- against existing non-dismissed insights before inserting), and doesn't
-- need the Vault-secret/pg_cron machinery ingestion-queue needed for a
-- true background job.

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
begin
  if not can_edit_subject(p_subject_id) then
    raise exception 'not authorized for subject %', p_subject_id;
  end if;

  -- ── vital trend drift ──────────────────────────────────────────────
  -- Compares the average of the 3 most recent readings (last 30 days)
  -- against the average of the 3 readings before that (last 90 days).
  -- Needs at least 4 total readings so a single noisy point can't fire it.
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
    end if;
  end loop;

  -- ── out-of-range lab markers ───────────────────────────────────────
  -- One insight per specific lab_marker row, deduped by that row's id so
  -- re-running this never double-fires on the same result.
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
    end if;
  end loop;

  -- ── medication adherence drop ──────────────────────────────────────
  -- Mirrors computeAdherence() in src/lib/supabase/mappers.ts: 30-day
  -- window, taken/total. Needs at least 4 logged doses to avoid firing
  -- off one or two skipped entries.
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
    end if;
  end loop;
end;
$$;

-- Raag — background ingestion queue
--
-- Closes a real gap: parse-record was only ever invoked as a client-side
-- fire-and-forget call right after upload. If that invoke silently failed
-- (network blip, tab closed, cold start timeout), the document stayed
-- 'pending' forever with no retry. This adds a durable backstop: a
-- pg_cron job sweeps for pending/failed documents every minute and
-- redispatches them via pg_net, entirely off the request path.
--
-- The client-triggered immediate invoke in supabase.ts stays as-is (fast
-- path for the common case) — this is the resilience layer underneath it,
-- not a replacement.
--
-- SETUP REQUIRED (see the Edge Function's updated auth handling):
--   1. In parse-record's Edge Function secrets (same place as
--      ANTHROPIC_API_KEY), add: INTERNAL_QUEUE_SECRET = <value below>
--   2. Run the vault.create_secret call at the bottom of this file with
--      that SAME value — this is a value Claude generated for this
--      purpose, not your service-role key or DB password.

create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table source_documents add column if not exists retry_count integer not null default 0;
alter table source_documents add column if not exists last_attempted_at timestamptz;

create or replace function process_pending_documents()
returns void language plpgsql security definer set search_path = public as $$
declare
  doc record;
  queue_secret text;
  anon_key text := 'sb_publishable_seNNpZK9_vnpCdRnHlC5KA_qyqzIGnZ'; -- public key, safe to embed
  function_url text := 'https://tntznncjqexgktuuadep.supabase.co/functions/v1/parse-record';
begin
  select decrypted_secret into queue_secret from vault.decrypted_secrets where name = 'internal_queue_secret';
  if queue_secret is null then
    raise notice 'internal_queue_secret not set in Vault — skipping this run';
    return;
  end if;

  for doc in
    select id from source_documents
    where mime_type ~ '^(image/|application/pdf)'
      and (
        (ocr_status = 'pending' and (last_attempted_at is null or last_attempted_at < now() - interval '2 minutes'))
        or (ocr_status = 'failed' and retry_count < 3 and last_attempted_at < now() - interval '10 minutes')
      )
    order by uploaded_at
    limit 5
  loop
    update source_documents
      set retry_count = retry_count + 1, last_attempted_at = now()
      where id = doc.id;

    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'apikey', anon_key,
        'x-internal-secret', queue_secret
      ),
      body := jsonb_build_object('documentId', doc.id),
      timeout_milliseconds := 30000
    );
  end loop;
end;
$$;

select cron.schedule('process-pending-documents', '* * * * *', 'select process_pending_documents();');

-- Run this once, with the SAME value you set as INTERNAL_QUEUE_SECRET in
-- the Edge Function secrets:
-- select vault.create_secret('<your-internal-queue-secret>', 'internal_queue_secret');

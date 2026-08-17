-- Raag — service_role table grants
--
-- Same class of bug as 0002_grants.sql, discovered the same way (a real
-- write silently failing with 42501 until tested end-to-end): RLS policies
-- and "service_role bypasses RLS" do NOT imply service_role has ordinary
-- Postgres table privileges. It still needs explicit GRANTs like any role.
-- 0002 granted authenticated/anon but never included service_role — every
-- service-role Edge Function write (razorpay webhooks, the parse-record
-- internal queue path, anything using SUPABASE_SERVICE_ROLE_KEY) has been
-- silently failing with "permission denied" this whole time. This closes
-- that gap for every existing table and every future one.

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

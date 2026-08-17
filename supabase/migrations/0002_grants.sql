-- Orvana — baseline role privileges
--
-- 0001_init.sql enabled RLS on every table but never granted table-level
-- privileges to the `anon` / `authenticated` roles the Supabase API runs
-- requests as. Postgres checks GRANTs *before* evaluating RLS policies —
-- without this, every request fails with "permission denied for table x"
-- regardless of how correct the RLS policy is, which is what verification
-- caught (see chat log: signup succeeded, but every subsequent read failed
-- with 42501, not an empty/RLS-filtered result).
--
-- RLS remains the actual authorization boundary. These grants only unlock
-- *attempting* an operation — which rows are visible/writable is still
-- entirely governed by the can_view_subject/can_edit_subject policies.
-- `anon` gets read-only (still filtered to nothing by RLS, since every
-- policy requires auth.uid()); `authenticated` gets full CRUD, filtered
-- per-row by the same policies.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- cover tables/functions added by future migrations without repeating this
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;

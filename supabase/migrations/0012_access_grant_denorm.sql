-- Raag — denormalize grantee name/email onto access_grants
--
-- getAccessGrants() needs to show who a subject is shared with, but
-- `profiles` RLS (profiles_self: id = auth.uid()) deliberately only lets
-- a user read their own profile row — there's no RLS-permitted way for a
-- subject owner to look up another user's profile by id, and
-- access_grants.grantee_user_id references auth.users, not profiles, so
-- PostgREST can't embed-join them anyway. Simplest correct fix:
-- snapshot the grantee's name/email onto the grant row at creation time
-- (grantAccess() already has this from the lookup-user-by-email Edge
-- Function response) rather than trying to read it back later.

alter table access_grants add column if not exists grantee_name text;
alter table access_grants add column if not exists grantee_email text;

-- Raag - fix account deletion FK blockers
--
-- delete-account (Edge Function) was failing with "Database error
-- deleting user" - found by actually running the delete-account
-- verification (npm run verify:functions), not assumed working. Root
-- cause: seven columns record "who performed this action" via a uuid
-- column referencing auth.users(id) with no ON DELETE behavior
-- specified, which defaults to NO ACTION - Postgres refuses to delete a
-- user row that's still referenced anywhere. Confirmed live: a fresh
-- test account that had sent exactly one ai-chat message (which writes
-- an audit_log row with actor_user_id = that user before the row it
-- needs even considers the model call) could not delete itself. The
-- same class of bug plausibly extends to any user who's logged a vital/
-- symptom/dose, uploaded a document, or granted someone access - i.e.
-- most real users, not an edge case. Right-to-erasure (DPDP/GDPR) was
-- silently broken for exactly the accounts most likely to have real data.
--
-- Fix: ON DELETE SET NULL, not CASCADE - the actor being unknown after
-- their own account is deleted is fine (and correct for audit_log,
-- which must survive account deletion to remain a real audit trail);
-- deleting the underlying record they authored is not, since that data
-- belongs to the subject (which may still exist and be visible to a
-- family member via access_grants), not to the acting user.

alter table audit_log alter column actor_user_id drop not null;
alter table audit_log drop constraint audit_log_actor_user_id_fkey;
alter table audit_log add constraint audit_log_actor_user_id_fkey
  foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table chat_messages alter column user_id drop not null;
alter table chat_messages drop constraint chat_messages_user_id_fkey;
alter table chat_messages add constraint chat_messages_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table access_grants alter column granted_by drop not null;
alter table access_grants drop constraint access_grants_granted_by_fkey;
alter table access_grants add constraint access_grants_granted_by_fkey
  foreign key (granted_by) references auth.users(id) on delete set null;

alter table source_documents alter column uploaded_by drop not null;
alter table source_documents drop constraint source_documents_uploaded_by_fkey;
alter table source_documents add constraint source_documents_uploaded_by_fkey
  foreign key (uploaded_by) references auth.users(id) on delete set null;

alter table dose_logs alter column logged_by drop not null;
alter table dose_logs drop constraint dose_logs_logged_by_fkey;
alter table dose_logs add constraint dose_logs_logged_by_fkey
  foreign key (logged_by) references auth.users(id) on delete set null;

alter table vitals alter column logged_by drop not null;
alter table vitals drop constraint vitals_logged_by_fkey;
alter table vitals add constraint vitals_logged_by_fkey
  foreign key (logged_by) references auth.users(id) on delete set null;

alter table symptoms alter column logged_by drop not null;
alter table symptoms drop constraint symptoms_logged_by_fkey;
alter table symptoms add constraint symptoms_logged_by_fkey
  foreign key (logged_by) references auth.users(id) on delete set null;

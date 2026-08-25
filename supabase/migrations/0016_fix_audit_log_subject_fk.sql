-- Raag - second account-deletion FK blocker
--
-- 0015 fixed audit_log.actor_user_id but delete-account still failed
-- after that migration ran - confirmed by re-running
-- npm run verify:functions, not assumed fixed. Same root cause, a
-- different column: audit_log.subject_id references health_subjects(id)
-- with no ON DELETE behavior (NO ACTION by default), while every other
-- subject-scoped table cascades. ai-chat's own audit_log insert sets
-- subject_id on every "ai_context_read" row, so this blocked
-- health_subjects from being cascade-deleted the moment auth.users tried
-- to delete-cascade into it via owner_user_id - same failure, one level
-- up the chain from 0015's fix.
--
-- SET NULL, not CASCADE, for the same reason as 0015: the audit trail
-- must survive the subject being deleted to remain a real audit trail.

alter table audit_log drop constraint audit_log_subject_id_fkey;
alter table audit_log add constraint audit_log_subject_id_fkey
  foreign key (subject_id) references health_subjects(id) on delete set null;

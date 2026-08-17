-- Raag — profile fields the UI contract already expected but the
-- schema never persisted (height/weight/blood type), plus a flag to route
-- a newly-confirmed user into onboarding exactly once.

alter table health_subjects add column if not exists height_cm numeric;
alter table health_subjects add column if not exists weight_kg numeric;
alter table health_subjects add column if not exists blood_type text;

alter table profiles add column if not exists onboarding_completed boolean not null default false;

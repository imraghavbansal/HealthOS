# Atlas Health — Project Context

Read this first, every session. It's the current state of truth for what
Atlas is, what's built, what's verified, what's still open, and what
decisions are pending. Deeper docs live in `docs/` — this file is the map
to them plus the up-to-date status, since the docs below don't self-update.

## What this project is

Atlas Health — a long-term personal and family health OS. Not a chatbot
with a health skin, not a record locker, not a tracker. The product:
**Atlas remembers your health over time and helps you understand the
bigger picture.** Originally scaffolded by Lovable (now fully de-branded),
being turned into a real production product with a real backend, real
users, and a path to app-store distribution and revenue.

Full product philosophy: **`docs/PRODUCT-VISION.md`** — read this before
any product decision. Key points: longitudinal record > feature list; the
moat is accumulated data + trust, not the AI model; family is a real
permission system (`health_subjects` + `access_grants`), not a text field;
source documents and AI-extracted facts are stored separately with
provenance; AI never diagnoses, always cites or abstains.

Business model / pricing tiers: **`docs/BUSINESS-MODEL.md`**.
Coding conventions (design system, data-access rules, motion): **`docs/AGENT-BRIEF.md`**.
Original architecture handoff (now partially superseded by this file): **`docs/HANDOFF.md`**.
**Governing execution spec — supersedes ad-hoc requests if they conflict:
`docs/MASTER-BUILD-SPEC.md`.** Read this for the required build order,
non-negotiable AI guardrails, "definition of done" checklist, latency
requirements, and the required status-report format. This file tracks
progress *against* that spec.

## Stack

TanStack Start (React 19) + TanStack Router/Query + Vite + Tailwind v4 +
Radix UI, on the frontend — unchanged from the original scaffold, and per
the master spec, **never redesign the UI to make a backend integration
cleaner.** Backend: Supabase (Postgres + Auth + Storage + Edge Functions).
AI: Anthropic Claude (`claude-sonnet-5`), called only from Edge Functions,
key never client-exposed.

Everything in the UI reads/writes through `@/lib/queries` →
`src/lib/api/contract.ts` (the `AtlasApi` interface) → one of three
adapters selected by `VITE_API_MODE`: `mock` (in-memory demo),
`supabase` (real, what's actually deployed), `http` (unused stub for a
hypothetical non-Supabase backend). **Never bypass the contract from a
route file.**

Supabase project: `tntznncjqexgktuuadep` (see `.env` for URL/anon key —
gitignored, not in this file). **The user has never shared and must never
be asked for the DB password, service_role key, or any Supabase personal
access token.** Every privileged server-side operation goes through an
Edge Function reading its own auto-injected `SUPABASE_SERVICE_ROLE_KEY`
env var, or through a purpose-built shared secret Claude generates
(see `INTERNAL_QUEUE_SECRET` below) — never through the user handing over
a credential.

## Schema & migrations

`supabase/migrations/*.sql`, applied in order, each **run manually by the
user** via the SQL Editor (no CLI link exists — deliberate, so DB
credentials never pass through Claude). Migrations so far:

- `0001_init.sql` — core schema. Key design: clinical data hangs off
  `health_subjects` (a person with a health history — the account holder
  themself, `kind='self'`, or a dependent), not a raw user id. Real
  household/sharing model: `households`, `household_members`,
  `access_grants` (scoped, revocable, `can_view_subject`/`can_edit_subject`
  functions gate every table's RLS). Separate from that: `family_history_entries`
  is free-text ancestry data about relatives who aren't Atlas users.
- `0002_grants.sql` — **critical fix**: RLS policies alone aren't enough:
  Postgres checks table-level `GRANT`s before RLS. `0001` forgot these;
  every real query failed with `permission denied` until this ran. If a
  future migration adds a table and reads mysteriously fail, check this first.
- `0003_profile_fields.sql` — `height_cm`/`weight_kg`/`blood_type` on
  `health_subjects`, `onboarding_completed` on `profiles`.
- `0004_storage.sql` — `medical-records` Storage bucket + path-scoped RLS
  (`<subject_id>/...` prefix convention is load-bearing).
- `0005_notification_preferences.sql` — real table + backfill for
  pre-existing accounts (the bootstrap trigger only fires on new signups).
- `0006_ingestion_queue.sql` — `pg_cron` + `pg_net` background retry queue
  for document parsing (see Edge Functions below). Needs a Vault secret
  (`internal_queue_secret`) set separately via `vault.create_secret(...)` —
  easy to forget, caused a real bug (see Known Gotchas below).

**Regression tests, not throwaway scripts** — re-run after any schema/
function change:
- `npm run verify:supabase` — schema presence, signup bootstrap trigger,
  persistence, cross-user RLS isolation (actually attempts the attack),
  unauthenticated failure cases, audit-log append-only. 24 checks.
- `npm run verify:functions` — notification_preferences, `ai-chat`
  reachability, `delete-account` (actually deletes a test account and
  confirms it can no longer sign in).
- `scripts/verify-parse-record.mjs`, `scripts/verify-ai-chat-safety.mjs`,
  `scripts/verify-ingestion-queue.mjs` — targeted checks for those pieces.

All of these need `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in `.env`
and **"Confirm email" temporarily OFF** in Supabase Auth settings
(Authentication → Settings → User Signups) to get an immediate session on
signup — **must be back ON before any real user signs up.** This gets
toggled on/off a lot during test sessions; always double check its state
before ending a work session.

## Edge Functions

Deployed via Supabase Dashboard → Edge Functions (paste-and-deploy, no
CLI). Source of truth is always the file in `supabase/functions/*/index.ts` —
**if you edit one, the user must re-paste-and-deploy it; it doesn't
auto-sync.**

- **`parse-record`** — reads an uploaded document, asks Claude (tool-use,
  forced extraction schema) for structured facts (lab markers, conditions,
  medications), writes them with `source_document_id` provenance +
  `verified_by_user: false`, dedupes against existing rows (same
  name+day for labs, same name for conditions/active meds). Two auth
  paths: normal user JWT (fast path, invoked by the client right after
  upload, RLS-scoped), or `X-Internal-Secret` header matching
  `INTERNAL_QUEUE_SECRET` (the `pg_cron` retry sweep, uses the service-role
  key internally, safe because it only ever touches the one already-existing
  documentId the queue selected). Secrets: `ANTHROPIC_API_KEY`,
  `INTERNAL_QUEUE_SECRET`.
- **`ai-chat`** — "Ask Atlas". Deterministic red-flag symptom check runs
  *before* any model call (chest pain, stroke signs, suicidal ideation,
  anaphylaxis, etc. — see the pattern list in the file) and returns
  emergency guidance without touching Claude at all — verified to work
  even with zero API credit. Otherwise assembles structured context
  (labs/meds/vitals/symptoms/conditions/family history/doc summaries, each
  tagged with its row id) and streams the response as newline-delimited
  JSON (`{"type":"delta","text":...}` then `{"type":"done",...}`).
  Citations include `sourceId`/`sourceTable` now. No semantic/embedding
  search yet — see Known Gaps. Secret: `ANTHROPIC_API_KEY` (shared).
- **`delete-account`** — verifies caller's own JWT, then uses service-role
  to remove their Storage files and delete their `auth.users` row (cascades
  through everything via FK). Verified to actually work — a deleted test
  account can no longer sign in.
- **`request-report`** — referenced by `requestReport()` in the contract,
  **not built yet**. Reports page will error/queue-forever if used for real.

## Current status against `docs/MASTER-BUILD-SPEC.md` Section 2

(This is the part that goes stale fastest — update it whenever a stage's
status changes, don't let this drift from reality.)

- **Stage 1 (Auth + isolation): Done, verified.** Supabase Auth,
  signup/login/forgot-password/reset-password, RLS everywhere, route
  protection at the `AppShell` level (every authenticated page redirects
  to `/login` without a session). Cross-user RLS attack actually attempted
  and blocked, not assumed. 2FA/session-management UI not built (stubbed
  "coming soon", honestly disabled).
- **Stage 2 (Contract implementation): Done.** `src/lib/api/supabase.ts`
  implements the full `AtlasApi` contract. A few surfaces are honest empty
  states pending later stages: `getSleep`/`getActivity` (wait on
  wearables), `getRisks`/`getInsights` (wait on an alerts/risk engine,
  not yet built), `requestReport` (edge function doesn't exist).
- **Stage 3 (Storage + ingestion): Done, verified.** Real Storage upload,
  `parse-record` extraction with dedupe, background `pg_cron` retry queue
  as a resilience backstop under the client's fast-path invoke. Root-caused
  and fixed a real bug: the Vault secret (`internal_queue_secret`) was
  never created, so the queue function ran every minute "successfully"
  while silently doing nothing. `scripts/verify-ingestion-queue.mjs` now
  confirms the cron job dispatches (retry_count increments within ~45s of
  insert). Minor open item: that script confirms *dispatch*, not full
  round-trip delivery to `parse-record` (pg_net is async) — worth one more
  spot-check via `net._http_response`, not currently blocking.
- **Stage 4 (RAG + citations): Mostly done.** Red-flag escalation ✅
  verified working independent of billing. Streaming ✅ built and
  typechecked (not yet manually verified in-browser). Citations carry
  `sourceId`/`sourceTable` now. Cite-or-abstain is a strong system-prompt
  instruction, not a hard pre-model guard (no per-query relevance scoring
  without embeddings). **No semantic/embedding search** —
  `record_embeddings`/pgvector table exists in schema, nothing populates
  or queries it; deferred because Anthropic doesn't offer embeddings and
  no provider (Voyage/OpenAI) has been chosen. Actual AI answers haven't
  been tested end-to-end because the user's **Anthropic account has no
  billing/credit** — every real Claude call (parse-record extraction,
  ai-chat grounded answers) hits a clean, confirmed-working "credit balance
  too low" error. The plumbing is proven; the feature can't be experienced
  until billing is added.
- **Stage 5 (wearables): Not started.** Needs a Vital/Terra account +
  API key decision from the user.
- **Stage 6 (billing): Done, verified.** Switched from Stripe (assumed in
  `BUSINESS-MODEL.md`) to **Razorpay** — the user is India-based, and
  Stripe has restricted availability for new India-recipient accounts
  under RBI recurring-payment rules; Razorpay is the standard choice there.
  Real INR pricing: Pro ₹799/mo (₹7,999/yr), Family ₹1,999/mo (₹19,999/yr).
  Three Edge Functions: `razorpay-create-subscription` (starts checkout),
  `razorpay-webhook` (the ONLY place `profiles.plan` changes — verified via
  a self-signed fake Razorpay event: correctly rejects bad signatures,
  correctly grants Pro on `subscription.activated`, correctly revokes to
  Free on `subscription.cancelled`), `razorpay-cancel-subscription`. Full
  pricing page + Settings billing section wired to real checkout/cancel.
  Two real bugs found and fixed via this process: (1) Razorpay Plans were
  created in Live Mode while using a Test Mode API key — completely
  separate data silos, silently "not found" for everything; (2)
  **`service_role` never had table GRANTs at all** — same class of bug as
  `0002_grants.sql` but for `service_role` instead of `authenticated`/
  `anon`. Fixed in `0008_service_role_grants.sql`. This likely also fixes
  previously-unverifiable service-role write paths (e.g. parse-record's
  internal queue processing, which never got tested this deep since it
  always hit the Anthropic billing wall first) — worth a re-check once
  Anthropic billing is live.
- **Stage 7 (metering): Done, verified.** Free tier's 5 AI-questions/month
  cap enforced server-side in `ai-chat` (checked after the red-flag path —
  emergency guidance is never quota-blocked — but before context assembly/
  the model call, so an exhausted quota costs nothing). Confirmed: 6th
  question in a month is blocked with an upgrade message, no Anthropic
  call attempted, no audit-log entry (since no context was read); a
  within-quota question passes through normally.
- **Stages 8–9 (alerts engine, share links): Not started.**
- **Stage 10 (compliance): Partial.** Real `/privacy` and `/terms` pages
  built and linked from the landing footer (grounded in actual product
  behavior, not boilerplate — genuinely describes what's real: export/
  delete work today, RLS isolation is tested not assumed, AI provider
  data handling, etc. Marked clearly as not a substitute for legal
  review). `audit_log` exists, is append-only (verified), but is **not
  instrumented on reads** — only manually tested via one insert, per the
  master spec's own warning not to treat the table's existence as proof.
  No BAAs (that's a legal step only the user can execute with their
  vendors, not buildable). Real `audit_log`-on-read now covers both
  server-side sensitive-read paths that exist (`ai_context_read` in
  ai-chat, `document_read_for_parsing` in parse-record) — verified both
  fire correctly and don't fire when they shouldn't (e.g. a quota-blocked
  chat never logs a read, since it never reached one). Direct client-side
  reads (viewing your own dashboard pages) are NOT read-audited and
  structurally can't be at the DB level — Postgres has no SELECT triggers.
  Full read-audit of every dashboard view would need either routing all
  reads through a server layer (real latency cost, against the spec's own
  performance requirements) or enabling Supabase's infra-level query
  logging (a dashboard setting, not app code) — flagged to the user,
  not yet decided.

## Known gotchas (things that already bit us once)

- **Migrations must include explicit GRANTs**, not just RLS policies —
  `anon`/`authenticated` need table-level privileges before RLS can even
  be evaluated. `0002_grants.sql` fixed this once; watch for it on any new
  table.
- **`req.json()` can only be read once** in an Edge Function — capture
  `documentId`/`content` once up front in outer scope if you need it in a
  `catch` block; `req.clone()` after the body's already been read
  silently fails (this caused `parse-record` to never record failures
  until fixed).
- **Vault secrets must be created explicitly** — `select vault.create_secret(...)`
  is a separate statement from the migration that references it via
  `vault.decrypted_secrets`; easy to forget, and the failure mode is
  silent (the function just no-ops, pg_cron reports "succeeded").
- **Supabase's "Confirm email" setting has moved** in newer dashboard
  versions — it's under Authentication → Settings → User Signups, not
  under the Email provider panel.
- **Signup emails to `@example.com` are rejected** by Supabase as a known
  reserved/test domain — use `@mailinator.com` or similar in test scripts.
- **Postgres RLS silently no-ops disallowed UPDATEs** rather than erroring
  — a test asserting "should fail" needs to check the row didn't change,
  not that an error was thrown.
- Health-related copy must stay jurisdiction-neutral — an early version
  leaned on HIPAA (US-only) as the primary trust claim; now framed as
  "built around the principles of" HIPAA/GDPR/DPDP with honest
  non-certification disclosure, since a global (not just US) audience is
  the goal.

## Pending decisions (ask the user, don't assume)

- **Deploy V1-web to Vercel now, or keep building V2 features first?**
  Explicitly unresolved as of the last session — the user wants this
  decided before further work.
- Embeddings provider for semantic document search (Voyage vs OpenAI vs
  defer further) — needed to close the last Stage 4 gap.
- Capacitor mobile packaging — deliberately deferred until "V1-web" is
  confirmed solid; treat as its own focused push, not squeezed in.
- Sentry/error-tracking — needs the user's DSN, not started.

## How this user works

Wants brutal honesty about what's real vs. stubbed — explicitly rejects
"looks done" as a bar; the standard is persistence + authorization +
isolation + failure handling, each actually tested, not assumed. Prefers
automated verification scripts over manual click-through where possible,
but does real manual browser testing too and reports back precisely.
Comfortable with a lot of back-and-forth deploy→test→fix cycles (dashboard
paste-and-deploy for Edge Functions, SQL Editor for migrations) — this is
the established working rhythm, not a friction point to route around.
Building for a global audience (specifically flagged Indian users) — don't
default to US-centric assumptions in compliance copy or currency/units.

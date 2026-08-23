# Raag — Project Context

Read this first, every session. It's the current state of truth for what
Raag is, what's built, what's verified, what's still open, and what
decisions are pending. Deeper docs live in `docs/` — this file is the map
to them plus the up-to-date status, since the docs below don't self-update.

## What this project is

Raag — a long-term personal and family health OS. Not a chatbot
with a health skin, not a record locker, not a tracker. The product:
**Raag remembers your health over time and helps you understand the
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
progress _against_ that spec.

## Stack

TanStack Start (React 19) + TanStack Router/Query + Vite + Tailwind v4 +
Radix UI, on the frontend — unchanged from the original scaffold, and per
the master spec, **never redesign the UI to make a backend integration
cleaner.** Backend: Supabase (Postgres + Auth + Storage + Edge Functions).
AI: Anthropic Claude (`claude-sonnet-5`), called only from Edge Functions,
key never client-exposed.

Everything in the UI reads/writes through `@/lib/queries` →
`src/lib/api/contract.ts` (the `RaagApi` interface) → one of three
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
  is free-text ancestry data about relatives who aren't Raag users.
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
- **`ai-chat`** — "Ask Raag". Deterministic red-flag symptom check runs
  _before_ any model call (chest pain, stroke signs, suicidal ideation,
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
- **`get-shared-record`** — the public side of share links (Stage 9).
  Takes a `token`, service-role throughout since the caller has no
  session at all. Validates expiry/revocation, logs the access, returns
  a scope-filtered read-only view. No secrets beyond the auto-injected
  service-role key. Deployed, verified live.
- **`lookup-user-by-email`** — the one narrow exception to `profiles`
  RLS's self-only read policy. Used by the household/access-grant feature
  to resolve a family member's email to their user id when granting them
  access to a subject. Requires the caller to already be signed in (blocks
  anonymous enumeration), returns only `{ found, userId, name }` — never
  anything else about the target account. Not yet deployed — see
  "Household / family risk graph" below.
- **`send-push`** — delivers a real Web Push notification (VAPID + AES-
  128-GCM via `npm:web-push`, RFC 8291) to every device a user has
  subscribed from. Two auth paths, same shape as `parse-record`: a
  shared secret (`PUSH_TRIGGER_SECRET`, compared against an env var —
  Vault tables aren't exposed via PostgREST, so unlike other secrets
  this one is NOT read from `vault.decrypted_secrets` inside the
  function itself) for the automatic pg_net trigger, or the caller's own
  JWT for a self-test push. Secrets: `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_TRIGGER_SECRET`. Not yet
  deployed — see "Push notifications" below.

## Current status against `docs/MASTER-BUILD-SPEC.md` Section 2

(This is the part that goes stale fastest — update it whenever a stage's
status changes, don't let this drift from reality.)

- **Stage 1 (Auth + isolation): Done, verified.** Supabase Auth,
  signup/login/forgot-password/reset-password, RLS everywhere, route
  protection at the `AppShell` level (every authenticated page redirects
  to `/login` without a session). Cross-user RLS attack actually attempted
  and blocked, not assumed. 2FA/session-management UI not built (stubbed
  "coming soon", honestly disabled). **Google sign-in added** —
  `signInWithGoogle()` in `src/lib/auth.ts`, wired into `/login` and
  `/signup` via the shared `GoogleButton` component, landing on
  `/auth/callback` then routing to onboarding or dashboard. Built
  specifically to route around the production email-confirmation problem
  below — Google's already-verified email means no confirmation email is
  needed for that path at all. Google provider is now enabled in Supabase
  (OAuth client created, credentials pasted in) — **but the first live
  attempt hit a real bug**: `/auth/callback` errored `"PKCE code verifier
not found in storage"`. Root cause, confirmed by reading
  `@supabase/auth-js`'s `GoTrueClient` source directly
  (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`): the
  browser client's own `_initialize()` already auto-detects and exchanges
  a `?code=` in the URL when `detectSessionInUrl` is true (the default) —
  that exchange is single-use, since it deletes the PKCE `code_verifier`
  once consumed. The callback page was _also_ calling
  `exchangeCodeForSession(code)` manually right after, racing the
  automatic exchange; whichever ran second found the verifier already
  gone. Fixed by deleting the manual call entirely and just awaiting
  `supabase.auth.getSession()` — confirmed via source that `getSession()`
  itself `await`s the client's `initializePromise` before resolving, i.e.
  the exact promise that performs the automatic exchange, so no race is
  possible. Diagnosed and fixed from library source + build/typecheck,
  not yet confirmed via an actual browser click-through — worth a real
  test. Email/password confirmation was found
  broken in production (`raag-health.vercel.app`): the code was already
  correct (dynamic redirect, sends to whatever email the user enters) —
  root cause is Supabase's default built-in email service, which isn't
  meant for production and in practice only reliably delivers to the
  project owner's own inbox. Fix is custom SMTP (Resend recommended) via
  Auth → Settings → SMTP Settings, not yet done — see Pending decisions.
- **Stage 2 (Contract implementation): Done.** `src/lib/api/supabase.ts`
  implements the full `RaagApi` contract. Remaining honest-empty surface:
  `getSleep`/`getActivity` (wait on wearables, V2 not started),
  `requestReport` (edge function doesn't exist). `getInsights`/`getRisks`
  are now real — see Stage 8 below.
- **Stage 3 (Storage + ingestion): Done, verified.** Real Storage upload,
  `parse-record` extraction with dedupe, background `pg_cron` retry queue
  as a resilience backstop under the client's fast-path invoke. Root-caused
  and fixed a real bug: the Vault secret (`internal_queue_secret`) was
  never created, so the queue function ran every minute "successfully"
  while silently doing nothing. `scripts/verify-ingestion-queue.mjs` now
  confirms the cron job dispatches (retry_count increments within ~45s of
  insert). Minor open item: that script confirms _dispatch_, not full
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
- **Stage 5 (wearables): Architecture built and verified live; still
  blocked on the account decision (deliberately — user doesn't want the
  cost yet, explicitly asked to keep the plumbing ready).**
  `0014_wearables_architecture.sql`: real `sleep_entries`/
  `activity_entries` tables (RLS matching the standard
  `can_view_subject`/`can_edit_subject` pattern, unique on
  subject+provider+date so a redelivered webhook can't double-insert),
  `wearable_connections` extended with `last_sync_status`/
  `last_sync_error` for honest connection-state display later.
  `getSleep()`/`getActivity()` in `supabase.ts` now read these real
  tables instead of an unconditionally-hardcoded `[]` — whatever's
  actually in the DB renders. New Edge Function
  `supabase/functions/wearable-webhook/index.ts` has the
  provider-agnostic half done (shared-secret auth, subject resolution
  via `external_user_id`, idempotent upsert) with exactly one function,
  `parseProviderPayload()`, left throwing on purpose — Vital's and
  Terra's actual webhook JSON shapes differ and neither's been chosen,
  so guessing at that mapping now would be untested code pretending to
  be real. **Also fixed a real honesty problem found while scoping
  this**: the `/wearables` page's "Connect" button previously flipped a
  DB boolean with zero real effect behind it, while showing a pulsing
  "Live" badge as if a real connection existed. Replaced with an honest
  disabled "Coming soon" state + a banner explaining the architecture is
  ready but no provider is connected yet — matches the same
  honestly-disabled pattern Settings already used for 2FA. **Not yet
  applied/verified** — `npm run verify:wearables-architecture` was run
  against the live project before the migration, confirming exactly what
  you'd expect: table-not-found on both new tables, while the RLS-
  isolation checks still passed vacuously (no rows to leak). **User still
  needs to**: run `0014_wearables_architecture.sql` whenever ready (no
  urgency — nothing currently depends on it being live, `getSleep`/
  `getActivity` degrade to empty results via the same `unwrap()` error
  path every other missing-table case hits), then re-run
  `npm run verify:wearables-architecture` to confirm insert/read/RLS/
  unique-constraint all actually pass. The webhook function stays
  undeployed until there's a real provider to point it at.
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
- **Stage 8 (insights + risk engine): Done.** Both deterministic, no AI
  call, no Anthropic billing dependency. **Insights**:
  `generate_insights(p_subject_id)` in `0009_insights_engine.sql` —
  vital-trend drift (recent-vs-baseline average over vitals, per kind,
  threshold-gated), out-of-range lab markers, medication-adherence drop
  (mirrors `computeAdherence()`'s 30-day window). Security invoker, RLS-
  scoped via `can_edit_subject`, dedupes against existing non-dismissed
  rows before inserting so it's safe to call on every read — wired into
  `getInsights()` in `src/lib/api/supabase.ts`, which RPCs it before every
  select. `dismissInsight()` added end-to-end (contract → all three
  adapters → `useDismissInsight` mutation → dismiss button on the
  dashboard insight cards). **Risks**: `computeRiskFactors()` in
  `src/lib/supabase/mappers.ts` — additive point scoring across
  cardiovascular, type 2 diabetes, respiratory, and liver disease, from
  real lifestyle/vitals/conditions/family-history data; computed live on
  every `getRisks()` call, not stored, so always current. Deliberately
  doesn't attempt cancer-type risk categories — those need real clinical
  scoring models (e.g. Gail score) this heuristic can't responsibly
  approximate. **Insights verified live** via `npm run verify:insights`
  (`scripts/verify-insights-engine.mjs`) — signs up a real test user,
  seeds data crafted to trip each of the 3 rules, confirms all 3 fire,
  confirms re-running doesn't duplicate rows, confirms a second user's
  RPC call against this subject is rejected. Risk scoring
  (`computeRiskFactors()`) is pure client-side logic with no DB round
  trip — typechecked and built, not covered by that script; still needs
  a real manual check that a signed-in account with real data renders
  sane-looking risk cards, not just that the function doesn't throw.
- **Stage 9 (share links): Done, verified live.** Schema: `share_links`
  (server-generated token via `pgcrypto`'s `gen_random_bytes`, never
  client-chosen; `scope` one of summary/labs/medications/full;
  `expires_at`/`revoked_at`/`access_count`/`last_accessed_at`) +
  `share_link_access_log`, both in `0010_share_links.sql`, migration run.
  Owner-side management (create/list/revoke) is real RLS-scoped table
  access via `getShareLinks`/`createShareLink`/`revokeShareLink` in the
  contract, wired into a new `/share` page (nav entry added to
  `AppShell`). The public viewer side (`/shared/$token`, no AppShell, no
  session) goes through Edge Function `get-shared-record` — service-role,
  since RLS has nothing to authorize an anonymous visitor against, checks
  expiry/revocation itself, logs every access, and deliberately never
  exposes uploaded documents/files at any scope level (only structured
  data) — deployed. `src/lib/share.ts` is the client-side fetch helper,
  kept separate from `lib/queries.ts`/`lib/api/*` the same way
  `lib/auth.ts` is — the viewer has no session for those to assume.
  **Verified via `npm run verify:share-links`**: create → anonymous
  fetch succeeds → scope correctly includes labs and excludes
  doseLogs/familyHistory for a `labs`-scope link → access logged and
  counted → bogus/revoked/expired tokens all correctly rejected →
  another user can't read this subject's `share_links` rows via RLS. All
  checks passed against the live project.
- **Medication interactions (V2, not in the original numbered stages):
  Done, verified live.** NLM discontinued RxNav's Drug-Drug
  Interaction API on 2024-01-02 — confirmed by reading NLM's own docs and
  independent coverage, it's permanent, not an outage, and the rest of
  RxNav (name normalization) staying alive doesn't help since that's not
  the part that was needed. openFDA's label text is unstructured and
  unreliable to parse; DrugBank's free API needs signup approval and is
  itself retiring in 2026. Built instead as a curated, static table —
  `drug_interaction_rules` in `0011_medication_interactions.sql`, ~24
  well-documented major pairs (warfarin+NSAIDs, SSRI+MAOI, statins+
  certain antibiotics, benzodiazepines+opioids, etc.), each with a real
  source citation. Deliberately **not exhaustive** — framed that way
  everywhere it surfaces. `computeMedicationInteractions()` in
  `src/lib/supabase/mappers.ts` matches each active medication's
  free-text name against the rule aliases (case-insensitive substring —
  medication names are user-entered or AI-extracted, never guaranteed to
  equal a canonical drug name) and is wired into the existing
  `getMedications()` call, populating the `Medication.interactions`
  field the medications page UI was already built to render (the "needs
  attention" panel's copy — "Raag checks your active meds against a
  curated interaction database on every update" — predates this work and
  was literally describing this exact feature before it existed). No new
  UI needed. **Verified via `npm run verify:medication-interactions`**
  against the live project: rule table seeded (24 rows), RLS blocks
  writes to it from a regular user, and a known pair (warfarin +
  ibuprofen) is correctly detected as severity `major` against real
  inserted medications, with no false positive on an unrelated
  medication (Vitamin D3). All checks passed.
- **Household / family risk graph (V2, not in the original numbered
  stages): Built, not yet deployed/verified.** The privacy policy
  (`/privacy` §7) already promised "an adult account holder managing
  health records for a dependent... who doesn't have their own login" —
  the schema (`health_subjects` kind=dependent, `households`,
  `household_members`, `access_grants`) fully supported this already, but
  **no UI existed to actually use it**, discovered while investigating why
  most dashboard pages looked empty on a real account (they weren't
  broken — a fresh signup just starts with zero data everywhere; this
  gap was found alongside that, not caused by it). Built: `/family` page
  now has a real household graph (pure-CSS org-chart, no graph library —
  you as the root node, dependents as children, connected by real
  `owner_user_id` ownership, each node showing a live risk badge from the
  same `computeRiskFactors()` engine as `getRisks()`, generalized via a
  new `computeRisksForSubject(subjectId)` helper in `supabase.ts` so it
  works for any subject, not just self). "Add dependent" creates a real
  `health_subjects` row. Clicking a node opens who has access to that
  person's records (`access_grants`) with a real grant/revoke flow —
  granting requires the grantee to already have a Raag account (resolved
  by email via the new `lookup-user-by-email` Edge Function, since
  `profiles` RLS blocks looking up other users directly); their
  name/email are denormalized onto the grant row at creation time
  (`0012_access_grant_denorm.sql`) since there's no RLS-permitted way to
  read them back from `profiles` later. Deliberately doesn't support
  inviting someone who doesn't have an account yet — that needs a real
  invite-token flow (email delivery, pending-invite state), a bigger
  feature than this pass scoped. Typechecked, linted, built clean.
  **User still needs to**: run `0012_access_grant_denorm.sql`,
  paste-and-deploy `lookup-user-by-email`, then run
  `npm run verify:household` (add dependent → grantee has zero access
  before granting → grant → grantee can view but not edit under
  `summary` scope → an unrelated third user sees nothing → revoke →
  access actually gone) before trusting this live.
- **Conditions CRUD + doctor-visit prep pack (V2, not in the original
  numbered stages): Done, verified live.** `conditions` was previously
  write-only via AI document parsing (`parse-record`) — no way to view or
  manually add one existed, discovered while building the prep pack
  (which needs "active conditions" data that was otherwise always
  empty). Added `getConditions`/`addCondition`/`deleteCondition` to the
  contract — no new migration needed, `conditions` already had full RLS
  from `0001_init.sql`'s `subject_tables` loop. **Verified via
  `npm run verify:conditions`**: add → read back → cross-user isolation
  (RLS) → delete → confirmed actually gone. All checks passed against
  the live project. The prep pack itself (`/reports`, "Doctor visit prep
  pack") was previously a thin record-count + flagged-labs preview;
  rebuilt to assemble active conditions (now with inline add/delete),
  current medications with adherence, latest vitals snapshot, flagged
  labs, symptoms from the last 30 days, and an auto-generated "questions
  worth asking" list from active warning/critical insights and
  elevated/high risks — all deterministic, no AI call, so it works today
  without Anthropic billing. Typechecked, linted, and production-built
  clean; not covered by an automated script itself (pure client-side
  aggregation of already-verified endpoints), so worth one manual look
  once there's enough real data logged to populate every section.
- **Push notifications (V2, not in the original numbered stages):
  Deployed, DB/RLS side verified live.** Two gaps closed together, since push is
  meaningless without something to notify about: (1) **nothing had ever
  written to `notifications`** — the in-app bell was reading a table
  nobody inserted into since `0001_init.sql`, discovered while scoping
  this feature; (2) no push infrastructure existed. `0013_push_notifications.sql`:
  `push_subscriptions` table (RLS self-only), `notify_subject_owner()`
  helper (resolves a subject's responsible adult via `owner_user_id` and
  writes a real `notifications` row), `generate_insights()` extended to
  call it for each newly-created insight — gated per-insight-kind by the
  matching `notification_preferences` toggle (trend alerts / new lab
  results / medication reminders) so turning one off actually stops that
  notification, not just hides a UI element. Every `notifications` insert
  fires a fire-and-forget push via a `pg_net` trigger, same established
  pattern as `0006_ingestion_queue.sql`. New Edge Function `send-push`
  (VAPID + AES-128-GCM via `npm:web-push`). Client: `public/sw.js`
  (push + notificationclick only, deliberately no offline caching — a
  real decision for a health app, not an oversight), `src/lib/push.ts`
  (subscribe/unsubscribe/test, kept separate from `lib/queries.ts`/
  `lib/api/*` the same way `lib/auth.ts`/`lib/share.ts` are), a real
  toggle + "Send test notification" button replacing Settings' old
  "push delivery arrives with the mobile app" placeholder copy.
  **Deliberately doesn't cover medication-reminder pushes at a specific
  time** — `medications.schedule` is free text, not a structured time, so
  there's nothing reliably schedulable yet; adherence-drop _insights_
  still notify, actual scheduled reminders are a real gap, not silently
  dropped. VAPID key pair already generated (public key committed to
  `.env`/`.env.example` since it's genuinely public by design; private
  key and a generated `PUSH_TRIGGER_SECRET` were handed to the user in
  chat, never written to the repo). Typechecked, linted, production-built
  clean, and migration run + `send-push` deployed with its four secrets +
  `VITE_VAPID_PUBLIC_KEY` added to Vercel. **Verified via
  `npm run verify:push-notifications`**: push_subscriptions CRUD + RLS
  isolation, and confirmed `generate_insights()` now writes a real
  notification row (title/kind match the insight) — all checks passed
  against the live project. That script can't verify actual delivery
  (needs a real browser-issued subscription) — **still needs one manual
  check**: Settings → enable push → "Send test notification" → confirm a
  real browser/OS notification appears.
- **Capacitor mobile packaging (V2, deliberately the most partial item
  here): Scaffolded only — genuinely can't go further from this
  environment.** `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`,
  `@capacitor/android`, `@capacitor/push-notifications`, `@capacitor/app`
  installed. `capacitor.config.ts` created using the `server.url`
  approach (native WebView points at `https://raag-health.vercel.app`
  rather than bundling a static export) — deliberate: TanStack Start's
  Nitro server does real SSR (auth cookies, meta tags, streaming) a
  static-export pipeline would need to either replicate or drop, a
  separate, bigger effort. Trade-off stated in the config's own comment:
  needs network connectivity to load, same as the web version — no
  offline mode, consistent with the service worker's own deliberate
  no-caching decision. `npm run cap:sync` / `cap:open:ios` /
  `cap:open:android` scripts added (the former creates a throwaway
  `dist/index.html` placeholder first, since `webDir` must exist on disk
  even though it's unused with `server.url`).
  **What genuinely cannot be done from this environment**: `npx cap add
ios` requires Xcode, which only runs on macOS — this dev environment
  is Windows, so this was never attempted, not attempted-and-failed.
  `npx cap add android` needs the Android SDK, which may or may not be
  installed on the user's own machine. **Native push notifications are
  NOT wired up** — `send-push` only does Web Push (browser); real native
  push (FCM for Android, APNs for iOS, usually unified via Firebase
  Cloud Messaging) is separate infrastructure needing a Firebase project
  decision from the user, same "ask when blocked on an external account"
  pattern as wearables/embeddings below. **User's actual next steps**:
  (1) on a Mac, run `npm run cap:open:ios` → Xcode opens → sign in with
  an Apple ID, build to a simulator to confirm the shell loads the real
  site; (2) with Android Studio or just the Android SDK installed, run
  `npm run cap:open:android` similarly; (3) real store distribution
  needs an Apple Developer Program membership ($99/yr) and a Google Play
  Console account ($25 one-time) — business/account steps only the user
  can do, not buildable by Claude.
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
- **Remote git history was rewritten once already** (2026-08-18): a
  hardcoded Razorpay webhook secret + the internal queue secret leaked
  into two commits, GitGuardian flagged it, both secrets were rotated at
  the source and the old values scrubbed from every past commit via
  history rewrite, plus a pre-commit secret scanner
  (`scripts/scan-secrets.mjs` via `.githooks/pre-commit`) added to catch
  a repeat. **Any local clone from before that rewrite will diverge from
  origin/main and a plain `git push` will be rejected** — the fix is to
  `git fetch`, reset local `main` to `origin/main`, and cherry-pick only
  the genuinely new commits on top; never force-push an old, pre-rewrite
  branch over origin, since that would resurrect the leaked secrets in
  history.

## Pending decisions (ask the user, don't assume)

- **Resolved: deployed to Vercel** at `raag-health.vercel.app`. V2 work is
  now in progress against the live deployment.
- **Two dashboard steps needed to finish the auth fix, both the user's to
  do (never Claude's — no credentials handed over):**
  1. Google Cloud Console → OAuth client (type: Web application) →
     authorized redirect URI `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
     → paste the resulting client ID + secret into Supabase Auth →
     Providers → Google, toggle it on.
  2. Auth → Settings → SMTP Settings → enable custom SMTP with Resend (or
     similar) so email/password signup confirmation actually delivers to
     real users, not just the project owner. Also set Auth → URL
     Configuration → Site URL to `https://raag-health.vercel.app` and add
     it to Redirect URLs.
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

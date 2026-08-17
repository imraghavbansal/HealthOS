# Atlas Health — Master Build Spec

This is the governing execution instruction for turning Atlas Health into a
real, secure, low-latency, revenue-generating, app-store-published product.
It supersedes ad-hoc requests — if a future instruction conflicts with the
guardrails here, this document wins. Read alongside `PRODUCT-VISION.md`,
`HANDOFF.md`, `AGENT-BRIEF.md`, and `BUSINESS-MODEL.md`.

> Note: this doc references `atlas-health-moats-and-usp.md`, which isn't in
> the repo. `PRODUCT-VISION.md`'s "moat" section covers the same ground
> today — flag if there's separate content that should be merged in.

## 0. Mission

`existing product + real backend + real persistence + real AI + real
security + real payments + acceptable latency + store-ready mobile builds`

Not a rebuild. Not a demo. Not a "happy path that compiles."

## 1. Before writing code

- Audit the existing codebase end to end before each stage.
- Write a short plan: files affected, schema/migration changes, new
  dependencies, breaking changes, security implications, rollback plan.
- Never touch the UI/design system to make a backend integration "cleaner."
  The frontend reads everything through `@/lib/queries` →
  `src/lib/api/contract.ts` — implement the contract against a real
  backend, don't redesign around it.
- Confirm before anything destructive, irreversible, or structural to
  auth/billing/data isolation. Everything else: proceed.

## 2. Build order (boundaries — don't skip ahead)

1. Auth + per-user isolation
2. Contract implementation (`VITE_API_MODE=http`-equivalent live)
3. Storage + ingestion pipeline (upload → OCR/parse → structured write,
   original and extracted data always separately traceable)
4. RAG + citation layer (scoped retrieval, cite-or-abstain)
5. Wearable sync (aggregator, not per-vendor OAuth)
6. Billing (Stripe, server-side plan gating)
7. Metering + quotas (server-enforced)
8. Alerts engine (statistical drift, not threshold spam, ~1/week/rule)
9. Share links (signed, expiring, scoped, audited)
10. Compliance layer (BAAs, encryption, read-audit, retention, real
    export/delete)

Killer features (visit prep pack, explain-this, family risk graph, med
intelligence, etc.) only after stage 10 — lab PDF → structured trends
first, per the moats doc's priority order.

## 3. Non-negotiable AI guardrails

- Never diagnose or prescribe — information and questions-to-ask only.
- Cite or abstain — no answer without a source from the user's own data.
- Escalate red-flag symptoms (e.g. chest pain) to emergency guidance
  immediately, before anything else.
- "Informational only — not medical advice" visible on every AI surface.
- Never send the whole database to the model — retrieval is scoped and
  authorized per query.
- AI output is never the sole record of a fact — the original document
  stays the source of truth.

## 4. Definition of "done"

Not done because it compiles or the happy path works. Before marking
anything done: persistence survives reload/logout/days-later; authorization
is real; data isolation is *tested*, not assumed (attempt the cross-user
attack); failure handling (network/DB/upload/AI/timeout/duplicate/killed
mid-flow) is covered; input validation rejects bad data safely; secrets
never reach the client; retries never duplicate/corrupt.

No mock data, fake success states, simulated responses, or client-only
subscription checks presented as done. Say explicitly when something's
incomplete.

## 5. Latency & performance

Streaming AI responses; async heavy work (OCR, embeddings, drift
detection) off the request path with a real processing state; caching for
read-heavy low-churn data; indexes on every FK and filtered/sorted column;
pagination everywhere; per-user-scoped vector retrieval so latency doesn't
degrade platform-wide; warm hot paths if serverless; compressed/lazy assets,
offline-capable emergency card. Report *measured* p50/p95 for chat, lab
upload→parsed, and dashboard load per stage — not estimates.

## 6. Family/permission model

`person → account → family relationship → explicit grant → specific shared
data (scoped, revocable)`. Never flat text fields on the primary user — a
family member can eventually have their own account and independently
grant/revoke access, without a schema rewrite.

## 7. Compliance & store readiness (final phase)

Privacy policy, ToS, honest HIPAA posture, BAAs, verified retention/deletion
across DB + storage + vector index + backups, real export. App Store/Play
health-app requirements: permission justification, in-app account deletion,
no subscription dark patterns, restore-purchases, offline emergency card.
Stripe webhooks correct for failed payments/downgrades/cancellations, plan
state unspoofable from client. Error tracking + uptime alerting live before
real health data at scale. Real user-testing pass before submission.

## 8. Status reporting (required every boundary)

Implemented / Verified (how, specifically) / Remaining / Risks / Next.
Never call something production-ready off compilation or one happy path.

## 9. What not to do

Don't rewrite working UI for backend "cleanliness." Don't build
microservices/queues for hypothetical scale. Don't paywall a user's own
data — only intelligence/scale is gated. Don't silently do a large
rewrite — explain first. Don't treat an `audit_log` table's existence as
proof reads are audited — verify it actually captures reads, not just
writes.

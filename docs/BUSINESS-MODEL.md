# Atlas Health — business & monetization model

Use this as the source of truth when wiring real billing. The pricing page
(`src/routes/pricing.tsx`) already renders these tiers; only the payment
provider needs connecting.

## Positioning / USP

"The AI health record that actually reads *your* data."

- Wearables + labs + records + meds + family history unified into one graph.
- Every AI answer is grounded in the user's own documents, with inline citations.
- Preventive risk engine adjusted by family history, with concrete next actions.
- Trust posture: export/delete anytime, no data sale, no third-party model training.

Why it wins: trackers (Oura, WHOOP) show data but can't reason; ChatGPT reasons
but has no longitudinal record; patient portals (MyChart) hold records but are
per-provider and inert. Atlas owns the seam.

## Tiers (real, defensible)

| Tier | Price | Who | Why they pay |
|---|---|---|---|
| Free | $0 | Everyone (distribution engine) | 1 wearable, unlimited manual vitals, 5 AI questions/mo, basic lab trends |
| Pro | $19/mo or $190/yr | Health-optimizers, chronic-condition patients | Unlimited AI copilot + integrations, advanced trends, report export, care-team sharing |
| Family | $39/mo or $390/yr | Households, adult children of aging parents | 5 private seats, shared risk view, one billing owner |
| Clinic | Custom (~$8–15 PMPM) | Concierge clinics, employers, insurers | Unlimited seats, FHIR/EHR integration, admin + audit, BAA, SLA |

Annual = 2 months free (`monthly * 10`), already implemented in `priceFor()`.

### Free tier is the distribution strategy
Health is universal, so the free tier must be genuinely useful: full manual
logging, timeline, meds reminders, one device. Paywall the *intelligence and
scale* (unlimited AI, multi-device sync, exports, seats), never the user's own
data. Data is always exportable on every tier — that trust is the moat.

### Exclusive premium value (what people actually pay for)
1. Unlimited grounded AI copilot with citations to their own records.
2. Doctor-visit prep packs: auto-generated one-page summary + questions to ask.
3. Lab PDF parsing into structured trends (the highest-magic feature).
4. Multi-device sync + continuous anomaly alerts ("your resting HR drifted 6bpm").
5. Shareable clinician links with revocable, scoped access.
6. Family risk graph with per-condition screening schedules.

## Revenue mechanics to implement

- Stripe (or Paddle) Checkout + Customer Portal; store `plan` on the user row,
  mirror it into `UserProfile.plan` (`PlanTier` in `src/lib/types.ts`).
- Gate server-side, never in the UI only: AI question quota, device count,
  export access, seat count. Enforce in the server function/handler.
- 14-day Pro trial, no card, then downgrade to Free (retention beats churn spikes).
- Usage metering on AI calls for margin safety (cost per grounded answer).
- B2B2C: per-seat annual contracts with clinics/employers is where ARPU scales.

## Compliance gate (non-negotiable before real PII)

Signed BAA with the hosting/DB/LLM providers, encryption at rest + in transit,
row-level access control per user, audit log on every record read, and the
"informational only — not medical advice" disclaimer kept visible.

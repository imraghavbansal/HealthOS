# Atlas Health — Handoff

## Run it

```bash
bun install && bun run dev     # demo mode, no backend needed
```

## Architecture

```
src/lib/types.ts          canonical domain models (source of truth)
src/lib/api/contract.ts   the AtlasApi interface — one service surface
src/lib/api/mock.ts       in-memory implementation (VITE_API_MODE=mock)
src/lib/api/http.ts       REST implementation (VITE_API_MODE=http)
src/lib/api/index.ts      adapter switch + IS_DEMO flag
src/lib/queries.ts        TanStack Query hooks — the ONLY thing UI imports
src/components/motion.tsx Reveal / Stagger / Lift / AnimatedNumber / ProgressRing
src/components/data-states.tsx AsyncBoundary, skeletons, empty & error states
src/routes/*              one file per screen
```

No route file talks to a data source directly. Every screen reads from
`@/lib/queries`, so switching to a real backend is a config change, not a
rewrite.

## Going live

1. Implement the `AtlasApi` methods in `contract.ts` as REST endpoints
   (`GET /profile`, `GET /labs`, `POST /medications/:id/dose`, …).
2. Set `VITE_API_MODE=http` and `VITE_API_BASE_URL` (see `.env.example`).
3. Call `setAccessToken(token)` after sign-in; `http.ts` attaches the bearer.
4. AI chat: replace `mock.ts`'s `chat()` with a streaming endpoint. Keep the
   citation contract (`{ content, citations: [{ title, date }] }`) — the UI
   renders grounded sources from it.
5. Wearables: use an aggregator (Vital or Terra) instead of per-vendor OAuth.
6. Health data needs a signed BAA with your host before any real PII.

## Screens

Landing, Pricing, Sign-up/onboarding, Dashboard, AI Assistant, Timeline,
Medical Records, Lab Results, Vitals, Medications, Appointments, Wearables,
Nutrition, Symptoms, Goals, Family & Risk, Reports, Settings.

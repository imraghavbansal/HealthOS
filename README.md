# Atlas Health

Your AI-powered personal health OS — labs, wearables, records, medications,
and family history unified into one calm, AI-guided view. Atlas remembers
your health over time and helps you understand the bigger picture, rather
than treating every visit as a blank slate.

## Read this first

**`CLAUDE.md`** is the single source of truth for current project status —
what's built, what's verified, what's still open, and known gotchas. Start
there. Deeper context lives in `docs/`: `PRODUCT-VISION.md` (product
philosophy), `MASTER-BUILD-SPEC.md` (governing execution spec and build
order), `BUSINESS-MODEL.md` (pricing/tiers), `AGENT-BRIEF.md` (coding
conventions), `HANDOFF.md` (original architecture notes).

## Stack

TanStack Start (React 19) + TanStack Router/Query + Vite + Tailwind v4 +
Radix UI on the frontend. Supabase (Postgres + Auth + Storage + Edge
Functions) on the backend. Anthropic Claude for document parsing and the
AI assistant. Razorpay for billing.

Everything in the UI reads/writes through `@/lib/queries` →
`src/lib/api/contract.ts` (the `AtlasApi` interface) → one of three
adapters selected by `VITE_API_MODE`: `mock` (in-memory demo, no backend
needed), `supabase` (real, persisted — what's actually deployed), `http`
(unused stub for a hypothetical non-Supabase backend).

## Development

Requires Node.js 20+.

```sh
npm install
npm run dev      # defaults to mock mode — in-memory demo data, no backend needed
```

Copy `.env.example` to `.env` to configure `VITE_API_MODE=supabase` and
your Supabase project URL/anon key for real, persisted data. Server-only
secrets (Anthropic, Razorpay, etc.) are never in `.env` — they're set as
Supabase Edge Function secrets, see `CLAUDE.md` for the full list.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run preview` — preview a production build locally
- `npm run lint` — lint
- `npm run format` — format with Prettier
- `npm run verify:supabase` / `verify:functions` — regression checks against
  the live Supabase project (schema, RLS isolation, Edge Functions);
  re-run after any backend change. See `scripts/` for more targeted checks.

## Backend

Real, not a demo — schema and RLS policies in `supabase/migrations/`
(numbered, applied in order via the Supabase SQL Editor), server-side logic
in `supabase/functions/` (deployed via the Supabase dashboard). See
`CLAUDE.md` for exactly what's deployed, what's verified, and setup
instructions for each Edge Function.

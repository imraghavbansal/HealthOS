# Atlas Health

Your AI-powered personal health OS — labs, wearables, records, medications,
and family history unified into one calm, AI-guided view.

## Stack

TanStack Start (React 19) + TanStack Router/Query + Vite + Tailwind v4 +
Radix UI. See [docs/HANDOFF.md](docs/HANDOFF.md) for the data-flow
architecture and [docs/AGENT-BRIEF.md](docs/AGENT-BRIEF.md) for coding
conventions.

## Development

Requires Node.js 20+.

```sh
npm install
npm run dev      # demo mode, in-memory data, no backend needed
```

Copy `.env.example` to `.env` to configure API mode, backend URL, and
server-only secrets.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run preview` — preview a production build locally
- `npm run lint` — lint
- `npm run format` — format with Prettier

## Status

Currently runs entirely on in-memory demo data (`VITE_API_MODE=mock`).
See [docs/HANDOFF.md](docs/HANDOFF.md) for what's needed to go live with a
real backend, auth, and persistent user data.

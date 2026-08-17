# Atlas Health — build brief (for contributors/agents)

## Stack facts (non-negotiable)
- TanStack Start v1 + React 19 + Vite + Tailwind v4. **Not Next.js, not react-router.**
- Routes live in `src/routes/*.tsx` using `createFileRoute("/path")`. Never edit `src/routeTree.gen.ts`.
- Every authenticated page wraps content in `<AppShell title="..." subtitle="..." actions={...}>` from `@/components/app-shell`.
- Each route must define `head()` with a unique `title`, `description`, `og:title`, `og:description`.
- Toasts: `import { toast } from "sonner"`.
- Icons: `lucide-react`. Charts: `recharts`.

## Data access rules (critical)
- **Never import `@/lib/sample-data` or `@/lib/mock-db` in a component.**
- Read/write data ONLY through hooks in `@/lib/queries` (e.g. `useVitals`, `useAddVital`).
- Types come from `@/lib/types`.
- Handle async states with `@/components/data-states`: `AsyncBoundary`, `LoadingCards`, `LoadingRows`, `LoadingChart`, `EmptyState`, `ErrorState`.
  - Pattern: `<AsyncBoundary query={q} skeleton={<LoadingRows />} empty={<EmptyState title="..." />}>{(data) => ...}</AsyncBoundary>`
- Mutations are hooks returning TanStack `useMutation`; use `mutation.mutate(input)` and `mutation.isPending` to disable buttons.

## Design system rules
- Semantic tokens ONLY. Allowed: `bg-background text-foreground bg-card border-border text-muted-foreground bg-primary text-primary-foreground bg-muted bg-accent text-destructive bg-success text-success-foreground bg-warning text-warning-foreground text-teal`, and `chart-1..5`.
- **Never** `text-white`, `bg-black`, `bg-gray-*`, `bg-[#hex]`. Exception: `text-white` is allowed on top of `gradient-primary`.
- Custom utilities already defined: `glass`, `gradient-primary`, `gradient-hero`, `gradient-mint`, `gradient-glow`, `shadow-soft`, `text-gradient`, `font-display`, `animate-float`, `no-scrollbar`.
- Cards: `<Card className="rounded-3xl border-border/60">` + `<CardContent className="p-5">` or `p-6`.
- Pills/buttons: `className="rounded-full"`; primary CTA: `className="rounded-full gradient-primary text-white border-0"`.
- Headings inside pages: `font-display text-xl`. Small labels: `text-xs text-muted-foreground`.
- Must work in light AND dark mode (theme toggle is in the shell).

## Motion rules (interactivity level 4/5)
Use `@/components/motion`: `Reveal`, `Stagger` + `StaggerItem`, `Lift`, `AnimatedNumber`, `ProgressRing`, and `motion` (re-exported from `motion/react`).
- Wrap grids in `<Stagger className="grid ...">` with each child in `<StaggerItem>`.
- Wrap interactive cards in `<Lift>`.
- Animate key numbers with `<AnimatedNumber value={n} />`.
- Use `motion.div` with `layout` / `AnimatePresence` for lists that add/remove items.
- Keep it tasteful and calm — medical product, not a game.

## Responsiveness
Mobile-first. Grids: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. No horizontal overflow at 360px. Tap targets ≥ 44px for primary actions.

## Accessibility
One `<h1>` (AppShell provides it). `aria-label` on every icon-only button. Labels tied to inputs. Never rely on color alone.

## Quality bar
- Must typecheck (`npx tsgo --noEmit` equivalent runs in CI). No `any`, no unused imports.
- `noPropertyAccessFromIndexSignature` is on: use `import.meta.env['VITE_X']`.
- Prefer many small components in the same route file over one giant one; extract to `src/components/` if reused.
- Add the disclaimer line where clinically relevant: "Informational only — not medical advice."

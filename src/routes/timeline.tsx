import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
  Target,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AsyncBoundary, EmptyState, LoadingRows } from "@/components/data-states";
import { motion, Reveal } from "@/components/motion";
import { useTimeline } from "@/lib/queries";
import type { Severity, TimelineEvent } from "@/lib/types";

export const Route = createFileRoute("/timeline")({
  component: TimelinePage,
  head: () => ({
    meta: [
      { title: "Health Timeline · Orvana" },
      { name: "description", content: "Every lab, visit, medication change, vital, goal, and device event in one chronological view." },
      { property: "og:title", content: "Health Timeline · Orvana" },
      { property: "og:description", content: "A single unified timeline of your entire health history." },
    ],
  }),
});

type FilterKind = "all" | TimelineEvent["kind"];

const KIND_META: Record<TimelineEvent["kind"], { label: string; icon: LucideIcon; color: string }> = {
  lab: { label: "Labs", icon: FlaskConical, color: "bg-chart-1/20 text-chart-1" },
  visit: { label: "Visits", icon: Stethoscope, color: "bg-chart-2/20 text-chart-2" },
  med: { label: "Meds", icon: Pill, color: "bg-chart-3/20 text-chart-3" },
  vital: { label: "Vitals", icon: Activity, color: "bg-chart-4/20 text-chart-4" },
  goal: { label: "Goals", icon: Target, color: "bg-success/20 text-success-foreground" },
  device: { label: "Devices", icon: Watch, color: "bg-chart-5/20 text-chart-5" },
  note: { label: "Notes", icon: FileText, color: "bg-muted text-muted-foreground" },
};

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "lab", label: "Labs" },
  { key: "visit", label: "Visits" },
  { key: "med", label: "Meds" },
  { key: "vital", label: "Vitals" },
  { key: "goal", label: "Goals" },
  { key: "device", label: "Devices" },
];

const SEVERITY_DOT: Record<Severity, string> = {
  info: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
};

function TimelinePage() {
  const query = useTimeline();
  const [filter, setFilter] = useState<FilterKind>("all");

  return (
    <AppShell title="Health Timeline" subtitle="Every event, in one chronological thread.">
      <AsyncBoundary
        query={query}
        skeleton={<LoadingRows count={6} />}
        empty={<EmptyState title="No events yet" body="Once you log data, your timeline will appear here." />}
      >
        {(events) => <TimelineBody events={events} filter={filter} setFilter={setFilter} />}
      </AsyncBoundary>
    </AppShell>
  );
}

function TimelineBody({
  events,
  filter,
  setFilter,
}: {
  events: TimelineEvent[];
  filter: FilterKind;
  setFilter: (f: FilterKind) => void;
}) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );
  const filtered = useMemo(
    () => (filter === "all" ? sorted : sorted.filter((e) => e.kind === filter)),
    [sorted, filter],
  );

  const flagged = sorted.filter((e) => e.severity === "warning" || e.severity === "critical").length;
  const dates = sorted.map((e) => new Date(e.date).getTime());
  const min = dates.length ? new Date(Math.min(...dates)) : null;
  const max = dates.length ? new Date(Math.max(...dates)) : null;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">Total events</div>
              <div className="font-display text-3xl mt-1">{sorted.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">Flagged</div>
              <div className="font-display text-3xl mt-1 text-warning">{flagged}</div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">Date range</div>
              <div className="font-display text-lg mt-1">
                {min && max ? `${fmt(min)} — ${fmt(max)}` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>
      </Reveal>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`relative rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter === f.key && (
              <motion.span
                layoutId="timeline-filter-pill"
                className="absolute inset-0 rounded-full gradient-primary"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-5 lg:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-teal to-transparent lg:-translate-x-1/2" />
        <ul className="space-y-6">
          <AnimatePresence initial={false}>
            {filtered.map((event, i) => (
              <TimelineRow key={event.id} event={event} index={i} />
            ))}
          </AnimatePresence>
        </ul>
        {filtered.length === 0 && (
          <div className="pl-14 lg:pl-0">
            <EmptyState title="No events for this filter" body="Try a different category." />
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ event, index }: { event: TimelineEvent; index: number }) {
  const meta = KIND_META[event.kind];
  const Icon = meta.icon;
  const isRight = index % 2 === 1;
  const date = new Date(event.date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className={`relative pl-14 lg:pl-0 lg:grid lg:grid-cols-2 lg:gap-8 ${isRight ? "" : ""}`}
    >
      <div className={`absolute left-5 lg:left-1/2 top-1 -translate-x-1/2 grid h-8 w-8 place-items-center rounded-full ${meta.color} ring-4 ring-background z-10`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className={`hidden lg:block ${isRight ? "" : "order-2"}`} />
      <div className={isRight ? "lg:col-start-2" : ""}>
        <Card className="rounded-3xl border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{event.title}</span>
                  {event.severity && (
                    <span
                      className={`h-2 w-2 rounded-full ${SEVERITY_DOT[event.severity]}`}
                      aria-label={`Severity: ${event.severity}`}
                    />
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[10px] shrink-0">
                {meta.label}
              </Badge>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">{date}</div>
          </CardContent>
        </Card>
      </div>
    </motion.li>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLabMarkers, useLabTrend } from "@/lib/queries";
import { AsyncBoundary, EmptyState, LoadingCards, LoadingChart } from "@/components/data-states";
import { Lift, Stagger, StaggerItem } from "@/components/motion";
import type { LabMarker, MarkerStatus } from "@/lib/types";
import { MessageSquareText, Search, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/labs")({ component: Labs });

type StatusFilter = "all" | "flagged" | "normal";

function statusColor(status: MarkerStatus) {
  if (status === "normal") return "bg-success/20 text-success-foreground";
  if (status === "low") return "bg-warning/20 text-warning-foreground";
  return "bg-destructive/15 text-destructive";
}

function statusDotColor(status: MarkerStatus) {
  if (status === "normal") return "bg-success";
  if (status === "low") return "bg-warning";
  return "bg-destructive";
}

/** Position (0-100%) of the current value along its reference range track. */
function rangePosition(marker: LabMarker) {
  const match = marker.range.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (!match) return 50;
  const lo = parseFloat(match[1]);
  const hi = parseFloat(match[2]);
  if (Number.isNaN(lo) || Number.isNaN(hi) || hi === lo) return 50;
  // Give 20% padding on either side so out-of-range values are still visible.
  const span = hi - lo;
  const paddedLo = lo - span * 0.4;
  const paddedHi = hi + span * 0.4;
  const pct = ((marker.value - paddedLo) / (paddedHi - paddedLo)) * 100;
  return Math.min(100, Math.max(0, pct));
}

function Labs() {
  const markersQ = useLabMarkers();
  const [sel, setSel] = useState<string>("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const trendQ = useLabTrend(sel);

  const markers = markersQ.data ?? [];
  const filtered = useMemo(() => {
    return markers.filter((m) => {
      if (query && !m.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (statusFilter === "flagged" && m.status === "normal") return false;
      if (statusFilter === "normal" && m.status !== "normal") return false;
      return true;
    });
  }, [markers, query, statusFilter]);

  const marker = markers.find((m) => m.name === sel);

  return (
    <AppShell title="Lab Results" subtitle="Interactive trends with plain-language explanations.">
      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Card className="rounded-3xl border-border/60 h-fit">
          <CardContent className="p-3 space-y-3">
            <div className="px-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search markers…"
                  className="pl-8 rounded-full h-9 text-sm"
                  aria-label="Search markers"
                />
              </div>
              <div className="flex gap-1.5 mt-2">
                {(["all", "flagged", "normal"] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`text-[11px] rounded-full px-2.5 py-1 capitalize transition ${
                      statusFilter === f ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <AsyncBoundary
              query={markersQ}
              skeleton={<LoadingCards count={4} className="space-y-2 px-1" />}
              empty={<EmptyState title="No lab markers" body="Upload a lab report to see results here." />}
            >
              {() =>
                filtered.length === 0 ? (
                  <EmptyState title="No matches" body="Try a different search or filter." />
                ) : (
                  <Stagger className="space-y-1">
                    {filtered.map((m) => (
                      <StaggerItem key={m.name}>
                        <MarkerCard m={m} selected={sel === m.name} onSelect={() => setSel(m.name)} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                )
              }
            </AsyncBoundary>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!marker ? (
            <EmptyState
              icon={Sparkles}
              title="Select a marker"
              body="Choose a lab marker from the list to see its trend and explanation."
            />
          ) : (
            <>
              <Card className="rounded-3xl border-border/60 overflow-hidden">
                <div className="gradient-hero p-6">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-xs uppercase text-primary tracking-widest">
                        {marker.status === "normal" ? "In range" : marker.status === "low" ? "Below reference" : "Above reference"}
                      </div>
                      <h2 className="font-display text-4xl mt-1">{marker.name}</h2>
                      <div className="mt-3 flex items-baseline gap-3">
                        <div className="font-display text-6xl">
                          {marker.value}
                          <span className="text-2xl text-muted-foreground ml-1">{marker.unit}</span>
                        </div>
                        <div
                          className={`text-sm flex items-center gap-1 ${
                            marker.delta > 0 ? "text-warning-foreground" : marker.delta < 0 ? "text-success" : "text-muted-foreground"
                          }`}
                        >
                          {marker.delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{" "}
                          {marker.delta > 0 ? "+" : ""}
                          {marker.delta}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Reference range: {marker.range} {marker.unit}
                      </div>
                    </div>
                    <Button asChild variant="outline" className="rounded-full">
                      <Link to="/assistant">
                        <MessageSquareText className="h-4 w-4 mr-1.5" /> Explain this marker
                      </Link>
                    </Button>
                  </div>
                </div>
                <CardContent className="p-6">
                  <AsyncBoundary query={trendQ} skeleton={<LoadingChart height={256} />}>
                    {(data) => (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data}>
                            <defs>
                              <linearGradient id="labGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                            <Tooltip
                              contentStyle={{
                                borderRadius: 12,
                                border: "1px solid var(--border)",
                                background: "var(--popover)",
                                fontSize: 12,
                              }}
                            />
                            <Area type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={3} fill="url(#labGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </AsyncBoundary>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-border/60">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-3">
                    <Sparkles className="h-4 w-4" /> What this means
                  </div>
                  <p className="text-sm leading-relaxed">{explainMarker(marker.name)}</p>
                  <p className="text-[11px] text-muted-foreground mt-4">Informational only — not medical advice.</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MarkerCard({ m, selected, onSelect }: { m: LabMarker; selected: boolean; onSelect: () => void }) {
  const pos = rangePosition(m);
  return (
    <Lift>
      <button
        onClick={onSelect}
        className={`w-full rounded-xl px-3 py-2.5 text-sm transition text-left ${
          selected ? "bg-primary/10 text-foreground" : "hover:bg-accent/50 text-muted-foreground"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">{m.name}</span>
          <Badge className={`rounded-full text-[10px] ${statusColor(m.status)}`}>{m.status}</Badge>
        </div>
        <div className="mt-2 relative h-1.5 rounded-full bg-muted">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-warning/30 via-success/30 to-destructive/30" />
          <div
            className={`absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border-2 border-background ${statusDotColor(m.status)}`}
            style={{ left: `calc(${pos}% - 5px)` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          {m.value} {m.unit} · ref {m.range}
        </div>
      </button>
    </Lift>
  );
}

function explainMarker(name: string) {
  switch (name) {
    case "Vitamin D":
      return "Vitamin D helps your body absorb calcium and supports immune, mood, and bone health. A downward trend often reflects less sun exposure and inconsistent supplementation. A conversation with your PCP about a short-term higher-dose regimen may be helpful.";
    case "LDL Cholesterol":
      return "LDL (\"low-density lipoprotein\") carries cholesterol through your bloodstream. Higher LDL is associated with cardiovascular risk, especially with a family history. Diet (soluble fiber, unsaturated fats), consistent aerobic exercise, and — if warranted — medication can bring this down.";
    case "HbA1c":
      return "HbA1c reflects your average blood sugar over the last ~3 months. Staying within the healthy range and trending stable is a good sign.";
    case "HDL":
      return "HDL is the \"good\" cholesterol. Higher is generally better; staying in a healthy range supports cardiovascular health.";
    case "TSH":
      return "TSH indicates thyroid function. Sitting comfortably within the reference range suggests normal thyroid activity.";
    case "Ferritin":
      return "Ferritin reflects iron stores. A normal but declining trend is worth keeping an eye on at your next panel.";
    default:
      return "This marker is tracked from your uploaded lab reports. Ask Raag Assistant for a deeper, personalized explanation.";
  }
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Droplet,
  Gauge,
  HeartPulse,
  Plus,
  Scale,
  Smile,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { AnimatedNumber, motion, Reveal, Stagger, StaggerItem, Lift } from "@/components/motion";
import { AnimatePresence } from "motion/react";
import { AsyncBoundary, EmptyState, LoadingRows } from "@/components/data-states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddVital, useVitals } from "@/lib/queries";
import type { VitalEntry, VitalKind } from "@/lib/types";

export const Route = createFileRoute("/vitals")({
  head: () => ({
    meta: [
      { title: "Vitals & Biometrics · Raag" },
      {
        name: "description",
        content: "Track weight, blood pressure, resting heart rate, SpO2 and more.",
      },
      { property: "og:title", content: "Vitals & Biometrics · Raag" },
      {
        property: "og:description",
        content: "Track weight, blood pressure, resting heart rate, SpO2 and more.",
      },
    ],
  }),
  component: VitalsPage,
});

const KIND_META: Record<
  VitalKind,
  { label: string; unit: string; icon: React.ComponentType<{ className?: string }> }
> = {
  weight: { label: "Weight", unit: "kg", icon: Scale },
  bloodPressure: { label: "Blood pressure", unit: "mmHg", icon: HeartPulse },
  restingHr: { label: "Resting HR", unit: "bpm", icon: Activity },
  spo2: { label: "SpO2", unit: "%", icon: Wind },
  temperature: { label: "Temperature", unit: "°C", icon: Thermometer },
  glucose: { label: "Glucose", unit: "mg/dL", icon: Droplet },
  mood: { label: "Mood", unit: "/10", icon: Smile },
};

const TILE_KINDS: VitalKind[] = ["weight", "bloodPressure", "restingHr", "spo2"];
const CHART_KINDS: VitalKind[] = ["weight", "bloodPressure", "restingHr", "spo2"];

function sortByDate(entries: VitalEntry[]) {
  return [...entries].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
}

function formatValue(kind: VitalKind, entry: VitalEntry) {
  if (kind === "bloodPressure") return `${entry.value}/${entry.secondary ?? "–"}`;
  return `${entry.value}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

function StatTile({ kind, entries }: { kind: VitalKind; entries: VitalEntry[] }) {
  const meta = KIND_META[kind];
  const sorted = sortByDate(entries);
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const Icon = meta.icon;

  if (!latest) {
    return (
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-4 w-4" /> {meta.label}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">No readings yet</div>
        </CardContent>
      </Card>
    );
  }

  const delta = prev ? latest.value - prev.value : 0;
  const up = delta > 0;
  const isBp = kind === "bloodPressure";
  const chartData = sorted.slice(-10).map((e) => ({ x: formatDate(e.recordedAt), v: e.value }));

  return (
    <Lift>
      <Card className="rounded-3xl border-border/60 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-4 w-4" /> {meta.label}
            </div>
            {prev && !isBp && (
              <span
                className={`flex items-center gap-0.5 text-xs ${up ? "text-destructive" : "text-success"}`}
              >
                {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(delta).toFixed(1)}
              </span>
            )}
          </div>
          <div className="mt-2 font-display text-2xl">
            {isBp ? (
              <span>
                {formatValue(kind, latest)}{" "}
                <span className="text-sm text-muted-foreground">{meta.unit}</span>
              </span>
            ) : (
              <>
                <AnimatedNumber value={latest.value} decimals={kind === "weight" ? 1 : 0} />{" "}
                <span className="text-sm text-muted-foreground">{meta.unit}</span>
              </>
            )}
          </div>
          <div className="mt-2 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`spark-${kind}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--chart-1)"
                  fill={`url(#spark-${kind})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </Lift>
  );
}

function MainChart({ kind, entries }: { kind: VitalKind; entries: VitalEntry[] }) {
  const sorted = sortByDate(entries);
  const data = sorted.map((e) => ({
    x: formatDate(e.recordedAt),
    v: e.value,
    secondary: e.secondary,
  }));

  if (data.length === 0) {
    return (
      <EmptyState title="No readings yet" body="Log your first reading to see the trend here." />
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
              color: "var(--foreground)",
            }}
          />
          <Line
            type="monotone"
            dataKey="v"
            name={kind === "bloodPressure" ? "Systolic" : KIND_META[kind].label}
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={false}
          />
          {kind === "bloodPressure" && (
            <Line
              type="monotone"
              dataKey="secondary"
              name="Diastolic"
              stroke="var(--chart-2)"
              strokeWidth={2.5}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LogReadingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const addVital = useAddVital();
  const [kind, setKind] = useState<VitalKind>("weight");
  const [value, setValue] = useState("");
  const [secondary, setSecondary] = useState("");
  const [mood, setMood] = useState([5]);
  const [note, setNote] = useState("");

  function reset() {
    setKind("weight");
    setValue("");
    setSecondary("");
    setMood([5]);
    setNote("");
  }

  function handleSubmit() {
    const meta = KIND_META[kind];
    const numericValue = kind === "mood" ? mood[0] : Number(value);
    if (kind !== "mood" && (!value || Number.isNaN(numericValue))) return;
    if (kind === "bloodPressure" && !secondary) return;

    addVital.mutate(
      {
        kind,
        value: numericValue,
        secondary: kind === "bloodPressure" ? Number(secondary) : undefined,
        unit: meta.unit,
        recordedAt: new Date().toISOString(),
        note: note || undefined,
        source: "manual",
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a reading</DialogTitle>
          <DialogDescription>Add a new vital reading to your history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="vital-kind">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as VitalKind)}>
              <SelectTrigger id="vital-kind" className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_META) as VitalKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "mood" ? (
            <div className="space-y-1.5">
              <Label>Mood ({mood[0]}/10)</Label>
              <Slider value={mood} onValueChange={setMood} min={1} max={10} step={1} />
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="vital-value">
                  {kind === "bloodPressure" ? "Systolic" : "Value"} ({KIND_META[kind].unit})
                </Label>
                <Input
                  id="vital-value"
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              {kind === "bloodPressure" && (
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="vital-secondary">Diastolic</Label>
                  <Input
                    id="vital-secondary"
                    type="number"
                    inputMode="decimal"
                    value={secondary}
                    onChange={(e) => setSecondary(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="vital-note">Note (optional)</Label>
            <Textarea
              id="vital-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything worth remembering about this reading"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full gradient-primary text-white border-0"
            disabled={addVital.isPending}
            onClick={handleSubmit}
          >
            {addVital.isPending ? "Saving…" : "Save reading"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadingRow({ entry }: { entry: VitalEntry }) {
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium">
            {formatValue(entry.kind, entry)}{" "}
            <span className="text-xs text-muted-foreground">{meta.unit}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {meta.label} · {relativeDate(entry.recordedAt)}
          </div>
        </div>
      </div>
      <Badge variant="outline" className="rounded-full text-[10px] capitalize">
        {entry.source}
      </Badge>
    </motion.div>
  );
}

function VitalsPage() {
  const vitalsQuery = useVitals();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<VitalKind>("weight");

  return (
    <AppShell
      title="Vitals & Biometrics"
      subtitle="Track your readings and spot trends early."
      actions={
        <Button
          className="rounded-full gradient-primary text-white border-0"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Log a reading
        </Button>
      }
    >
      <LogReadingDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AsyncBoundary
        query={vitalsQuery}
        skeleton={<LoadingRows count={4} />}
        empty={
          <EmptyState
            icon={Gauge}
            title="No vitals logged yet"
            body="Start tracking weight, blood pressure and more."
            action={
              <Button
                className="rounded-full gradient-primary text-white border-0"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Log a reading
              </Button>
            }
          />
        }
      >
        {(entries) => {
          // Plain computation, not useMemo - this render-prop callback
          // isn't a component or hook by React's own rules, so a hook
          // called here has no guaranteed stable call order across
          // renders (a real react-hooks/rules-of-hooks violation found
          // while doing an unrelated pass over this file). Building this
          // Map is cheap enough that recomputing it every render is fine.
          const byKind = new Map<VitalKind, VitalEntry[]>();
          for (const e of entries) {
            const list = byKind.get(e.kind) ?? [];
            list.push(e);
            byKind.set(e.kind, list);
          }

          const sortedAll = [...entries].sort(
            (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
          );

          return (
            <div className="space-y-6">
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {TILE_KINDS.map((k) => (
                  <StaggerItem key={k}>
                    <StatTile kind={k} entries={byKind.get(k) ?? []} />
                  </StaggerItem>
                ))}
              </Stagger>

              <Reveal>
                <Card className="rounded-3xl border-border/60">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-display text-xl">Trend</h2>
                      <div className="flex flex-wrap gap-1.5">
                        {CHART_KINDS.map((k) => (
                          <button
                            key={k}
                            onClick={() => setActiveKind(k)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              activeKind === k
                                ? "gradient-primary text-white"
                                : "bg-muted text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {KIND_META[k].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4">
                      <MainChart kind={activeKind} entries={byKind.get(activeKind) ?? []} />
                    </div>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal>
                <Card className="rounded-3xl border-border/60">
                  <CardContent className="p-5">
                    <h2 className="font-display text-xl">Recent readings</h2>
                    <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1 no-scrollbar">
                      <AnimatePresence initial={false}>
                        {sortedAll.map((entry) => (
                          <ReadingRow key={entry.id} entry={entry} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>

              <p className="text-xs text-muted-foreground">
                Informational only - not medical advice.
              </p>
            </div>
          );
        }}
      </AsyncBoundary>
    </AppShell>
  );
}

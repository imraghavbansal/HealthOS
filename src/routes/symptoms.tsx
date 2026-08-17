import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatePresence } from "motion/react";
import { AppShell } from "@/components/app-shell";
import { Lift, motion, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { AsyncBoundary, EmptyState, LoadingRows } from "@/components/data-states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddSymptom, useDeleteSymptom, useSymptoms } from "@/lib/queries";
import type { SymptomEntry } from "@/lib/types";

export const Route = createFileRoute("/symptoms")({
  head: () => ({
    meta: [
      { title: "Symptom Journal · Orvana" },
      { name: "description", content: "Log symptoms, track severity over time, and spot patterns." },
      { property: "og:title", content: "Symptom Journal · Orvana" },
      { property: "og:description", content: "Log symptoms, track severity over time, and spot patterns." },
    ],
  }),
  component: SymptomsPage,
});

const BODY_AREAS = ["Head", "Chest", "Abdomen", "Back", "Hands", "Legs", "Skin", "Whole body"];
const QUICK_TAGS = ["energy", "digestion", "pain", "sleep", "skin", "mood", "thyroid", "circulation", "screen time"];

function severityColor(sev: number) {
  if (sev <= 3) return "text-success";
  if (sev <= 6) return "text-warning";
  return "text-destructive";
}
function severityBg(sev: number) {
  if (sev <= 3) return "bg-success";
  if (sev <= 6) return "bg-warning";
  return "bg-destructive";
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LogSymptomCard() {
  const addSymptom = useAddSymptom();
  const [label, setLabel] = useState("");
  const [severity, setSeverity] = useState([4]);
  const [bodyArea, setBodyArea] = useState(BODY_AREAS[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleSubmit() {
    if (!label.trim()) return;
    addSymptom.mutate(
      {
        label: label.trim(),
        severity: severity[0],
        bodyArea,
        startedAt: new Date().toISOString(),
        tags,
        note: note || undefined,
      },
      {
        onSuccess: () => {
          setLabel("");
          setSeverity([4]);
          setBodyArea(BODY_AREAS[0]);
          setTags([]);
          setNote("");
        },
      },
    );
  }

  return (
    <Card className="rounded-3xl border-border/60">
      <CardContent className="p-5 space-y-4">
        <h2 className="font-display text-xl">Log symptom</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="symptom-label">What are you feeling?</Label>
            <Input id="symptom-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Headache" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="symptom-area">Body area</Label>
            <Select value={bodyArea} onValueChange={setBodyArea}>
              <SelectTrigger id="symptom-area" className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BODY_AREAS.map((area) => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Severity — <span className={`font-semibold ${severityColor(severity[0])}`}>{severity[0]}/10</span>
          </Label>
          <Slider value={severity} onValueChange={setSeverity} min={1} max={10} step={1} />
        </div>

        <div className="space-y-1.5">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tags.includes(tag) ? "gradient-primary text-white" : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="symptom-note">Note (optional)</Label>
          <Textarea id="symptom-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any context worth remembering" />
        </div>

        <div className="flex justify-end">
          <Button
            className="rounded-full gradient-primary text-white border-0"
            disabled={addSymptom.isPending || !label.trim()}
            onClick={handleSubmit}
          >
            {addSymptom.isPending ? "Saving…" : "Log symptom"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityChart({ entries }: { entries: SymptomEntry[] }) {
  const data = [...entries]
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .map((e) => ({
      x: new Date(e.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      severity: e.severity,
    }));

  return (
    <Card className="rounded-3xl border-border/60">
      <CardContent className="p-5">
        <h2 className="font-display text-xl">Severity over time</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--foreground)",
                }}
              />
              <Line type="monotone" dataKey="severity" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PatternsCard({ entries }: { entries: SymptomEntry[] }) {
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const tagCounts = new Map<string, number>();
    const areaCounts = new Map<string, number>();
    let totalSeverity = 0;
    for (const e of entries) {
      totalSeverity += e.severity;
      areaCounts.set(e.bodyArea, (areaCounts.get(e.bodyArea) ?? 0) + 1);
      for (const t of e.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topArea = [...areaCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const avgSeverity = totalSeverity / entries.length;
    return {
      topTag: topTag ? topTag[0] : "—",
      topArea: topArea ? topArea[0] : "—",
      avgSeverity,
    };
  }, [entries]);

  if (!stats) return null;

  return (
    <Card className="rounded-3xl border-border/60 bg-accent/30">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xl">Patterns</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Top tag</div>
            <div className="mt-1 font-semibold capitalize">{stats.topTag}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Avg severity</div>
            <div className="mt-1 font-semibold">{stats.avgSeverity.toFixed(1)}/10</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Most affected</div>
            <div className="mt-1 font-semibold">{stats.topArea}</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Your entries most often mention <span className="font-medium text-foreground">{stats.topTag}</span>, centered on{" "}
          <span className="font-medium text-foreground">{stats.topArea.toLowerCase()}</span>, with average severity{" "}
          <span className="font-medium text-foreground">{stats.avgSeverity.toFixed(1)}/10</span>.
        </p>
        <p className="text-xs text-muted-foreground">Informational only — not medical advice.</p>
      </CardContent>
    </Card>
  );
}

function SymptomCard({ entry }: { entry: SymptomEntry }) {
  const deleteSymptom = useDeleteSymptom();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Lift>
        <Card className="rounded-3xl border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{entry.label}</div>
                <div className="text-xs text-muted-foreground">
                  {entry.bodyArea} · {relativeDate(entry.startedAt)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-semibold ${severityColor(entry.severity)}`}>{entry.severity}/10</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                  aria-label={`Delete symptom entry: ${entry.label}`}
                  onClick={() => deleteSymptom.mutate(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${severityBg(entry.severity)}`} style={{ width: `${entry.severity * 10}%` }} />
            </div>
            {entry.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="rounded-full text-[10px] capitalize">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {entry.note && <p className="mt-2 text-sm text-muted-foreground">{entry.note}</p>}
          </CardContent>
        </Card>
      </Lift>
    </motion.div>
  );
}

function SymptomsPage() {
  const symptomsQuery = useSymptoms();

  return (
    <AppShell title="Symptom Journal" subtitle="Log how you feel and let patterns surface over time.">
      <div className="space-y-6">
        <Reveal>
          <LogSymptomCard />
        </Reveal>

        <AsyncBoundary
          query={symptomsQuery}
          skeleton={<LoadingRows count={4} />}
          empty={<EmptyState title="No symptoms logged yet" body="Use the form above to start your journal." />}
        >
          {(entries) => {
            const sorted = [...entries].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
            return (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Reveal>
                    <SeverityChart entries={entries} />
                  </Reveal>
                  <Reveal delay={0.05}>
                    <PatternsCard entries={entries} />
                  </Reveal>
                </div>

                <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence initial={false}>
                    {sorted.map((entry) => (
                      <StaggerItem key={entry.id}>
                        <SymptomCard entry={entry} />
                      </StaggerItem>
                    ))}
                  </AnimatePresence>
                </Stagger>
              </div>
            );
          }}
        </AsyncBoundary>
      </div>
    </AppShell>
  );
}

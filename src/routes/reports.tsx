import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Apple,
  Check,
  ClipboardCopy,
  FileJson,
  FileStack,
  FileText,
  HeartPulse,
  Pill,
  Plus,
  Printer,
  ShieldOff,
  Smile,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AsyncBoundary, LoadingRows } from "@/components/data-states";
import { motion, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useAddCondition,
  useConditions,
  useDeleteCondition,
  useInsights,
  useLabMarkers,
  useMedications,
  useRecords,
  useRequestReport,
  useRisks,
  useSymptoms,
  useVitals,
} from "@/lib/queries";
import type {
  Condition,
  Insight,
  Medication,
  ReportRequest,
  RiskFactor,
  SymptomEntry,
  VitalEntry,
} from "@/lib/types";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports & Data Export · Raag" },
      {
        name: "description",
        content:
          "Build custom reports, preview a doctor visit summary, and manage data portability.",
      },
      { property: "og:title", content: "Reports & Data Export · Raag" },
      { property: "og:description", content: "Export, summarize, and control your Raag data." },
    ],
  }),
});

const SCOPE_OPTIONS: { key: string; label: string; icon: typeof FileText }[] = [
  { key: "labs", label: "Labs", icon: Activity },
  { key: "records", label: "Records", icon: FileText },
  { key: "medications", label: "Medications", icon: Pill },
  { key: "vitals", label: "Vitals", icon: HeartPulse },
  { key: "nutrition", label: "Nutrition", icon: Apple },
  { key: "symptoms", label: "Symptoms", icon: Smile },
  { key: "goals", label: "Goals", icon: Target },
  { key: "family", label: "Family history", icon: Users },
];

const FORMAT_OPTIONS: {
  key: ReportRequest["format"];
  label: string;
  desc: string;
  icon: typeof FileText;
}[] = [
  {
    key: "pdf",
    label: "PDF",
    desc: "Clean, printable document for you or a provider.",
    icon: FileText,
  },
  {
    key: "json",
    label: "JSON",
    desc: "Structured data for backups or your own tools.",
    icon: FileJson,
  },
  {
    key: "fhir",
    label: "FHIR R4 bundle",
    desc: "Interoperable format for clinical systems.",
    icon: FileStack,
  },
];

function ReportsPage() {
  return (
    <AppShell
      title="Reports & Data Export"
      subtitle="Build reports, preview a visit summary, and manage your data."
    >
      <div className="space-y-8">
        <BuildReportSection />
        <DoctorSummarySection />
        <PortabilitySection />
        <p className="text-xs text-muted-foreground">
          Informational only - not medical advice. Reports summarize the data you've entered or
          connected and may not be complete or clinically validated.
        </p>
      </div>
    </AppShell>
  );
}

function BuildReportSection() {
  const [scope, setScope] = useState<string[]>(["labs", "records"]);
  const [from, setFrom] = useState("2025-01-01");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState<ReportRequest["format"]>("pdf");
  const mutation = useRequestReport();

  function toggleScope(key: string) {
    setScope((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function handleGenerate() {
    if (scope.length === 0) {
      toast.error("Choose at least one data type");
      return;
    }
    mutation.mutate({ scope, from, to, format });
  }

  return (
    <Reveal>
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-6 space-y-6">
          <div>
            <h2 className="font-display text-xl">Build a report</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose what to include, a date range, and a format.
            </p>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-3">Scope</div>
            <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SCOPE_OPTIONS.map((opt) => {
                const active = scope.includes(opt.key);
                const Icon = opt.icon;
                return (
                  <StaggerItem key={opt.key}>
                    <button
                      type="button"
                      onClick={() => toggleScope(opt.key)}
                      className={`w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={() => toggleScope(opt.key)}
                        aria-label={opt.label}
                      />
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="report-from">From</Label>
              <input
                id="report-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to">To</Label>
              <input
                id="report-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-3">Format</div>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ReportRequest["format"])}
              className="grid gap-3 sm:grid-cols-3"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <Label
                  key={opt.key}
                  htmlFor={`format-${opt.key}`}
                  className={`flex flex-col gap-2 rounded-2xl border p-4 cursor-pointer transition-colors ${
                    format === opt.key
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={opt.key} id={`format-${opt.key}`} />
                    <opt.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleGenerate}
              disabled={mutation.isPending}
              className="rounded-full gradient-primary text-white border-0 shadow-soft h-11 px-6"
            >
              {mutation.isPending ? "Generating…" : "Generate report"}
            </Button>
            {mutation.isPending && (
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full gradient-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "90%" }}
                  transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Reveal>
  );
}

/**
 * Doctor-visit prep pack (V2) - deterministic, template-assembled from
 * data already on file (conditions, meds, vitals, flagged labs, recent
 * symptoms, active insights/risks). No AI call, so it works today
 * without Anthropic billing; upgradeable to an AI-written narrative
 * later without changing the data plumbing.
 */
function DoctorSummarySection() {
  const recordsQuery = useRecords();
  const labsQuery = useLabMarkers();
  const conditionsQuery = useConditions();
  const medsQuery = useMedications();
  const vitalsQuery = useVitals();
  const symptomsQuery = useSymptoms();
  const insightsQuery = useInsights();
  const risksQuery = useRisks();

  const ready =
    recordsQuery.data &&
    labsQuery.data &&
    conditionsQuery.data &&
    medsQuery.data &&
    vitalsQuery.data &&
    symptomsQuery.data &&
    insightsQuery.data &&
    risksQuery.data;

  return (
    <Reveal delay={0.05}>
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="font-display text-xl">Doctor visit prep pack</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A one-page snapshot assembled from your data - conditions, meds, flagged results, and
              questions worth asking. Bring it to your next appointment.
            </p>
          </div>
          {!ready ? (
            <LoadingRows count={3} />
          ) : (
            <SummaryPreview
              records={recordsQuery.data!}
              labs={labsQuery.data!}
              conditions={conditionsQuery.data!}
              medications={medsQuery.data!}
              vitals={vitalsQuery.data!}
              symptoms={symptomsQuery.data!}
              insights={insightsQuery.data!}
              risks={risksQuery.data!}
            />
          )}
        </CardContent>
      </Card>
    </Reveal>
  );
}

function SummaryPreview({
  records,
  labs,
  conditions,
  medications,
  vitals,
  symptoms,
  insights,
  risks,
}: {
  records: { id: string; title: string; date: string }[];
  labs: { name: string; value: number; unit: string; range: string; status: string }[];
  conditions: Condition[];
  medications: Medication[];
  vitals: VitalEntry[];
  symptoms: SymptomEntry[];
  insights: Insight[];
  risks: RiskFactor[];
}) {
  const flagged = useMemo(
    () => labs.filter((l) => l.status === "high" || l.status === "low" || l.status === "critical"),
    [labs],
  );
  const activeConditions = useMemo(
    () => conditions.filter((c) => c.status !== "resolved"),
    [conditions],
  );
  const recentSymptoms = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return symptoms.filter((s) => new Date(s.startedAt).getTime() >= cutoff).slice(0, 8);
  }, [symptoms]);
  const latestVitals = useMemo(() => {
    const byKind = new Map<string, VitalEntry>();
    for (const v of [...vitals].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )) {
      if (!byKind.has(v.kind)) byKind.set(v.kind, v);
    }
    return [...byKind.values()];
  }, [vitals]);
  const questions = useMemo(() => {
    const fromInsights = insights
      .filter((i) => i.severity === "warning" || i.severity === "critical")
      .map((i) => i.title);
    const fromRisks = risks
      .filter((r) => r.level === "Elevated" || r.level === "High")
      .map((r) => `About my ${r.name.toLowerCase()} risk: ${r.action}`);
    return [...fromInsights, ...fromRisks].slice(0, 6);
  }, [insights, risks]);

  async function copySummary() {
    const text = buildSummaryText({
      records,
      flagged,
      activeConditions,
      medications,
      latestVitals,
      recentSymptoms,
      questions,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <div>
      <div
        id="print-summary"
        className="rounded-2xl border border-border/60 bg-muted/20 p-5 text-sm space-y-4"
      >
        <div className="font-display text-lg">Clinical Summary</div>
        <div className="text-xs text-muted-foreground">
          Generated {new Date().toLocaleDateString()} · {records.length} records on file
        </div>

        <SummarySection title={`Active conditions (${activeConditions.length})`}>
          <ConditionsEditor conditions={activeConditions} />
        </SummarySection>

        <SummarySection title={`Current medications (${medications.length})`}>
          {medications.length === 0 ? (
            <p className="text-muted-foreground">None on file.</p>
          ) : (
            <ul className="space-y-1">
              {medications.map((m) => (
                <li
                  key={m.id}
                  className="flex justify-between border-b border-border/40 py-1 last:border-0"
                >
                  <span>
                    {m.name} {m.dose ? `- ${m.dose}` : ""}
                  </span>
                  <span className="text-muted-foreground">{m.adherence}% adherence</span>
                </li>
              ))}
            </ul>
          )}
        </SummarySection>

        <SummarySection title={`Flagged lab markers (${flagged.length})`}>
          {flagged.length === 0 ? (
            <p className="text-muted-foreground">No markers currently out of range.</p>
          ) : (
            <ul className="space-y-1">
              {flagged.map((m) => (
                <li
                  key={m.name}
                  className="flex justify-between border-b border-border/40 py-1 last:border-0"
                >
                  <span>{m.name}</span>
                  <span className="text-muted-foreground">
                    {m.value} {m.unit} · range {m.range} · {m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SummarySection>

        <SummarySection title="Latest vitals">
          {latestVitals.length === 0 ? (
            <p className="text-muted-foreground">None logged.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {latestVitals.map((v) => (
                <span key={v.kind}>
                  {v.kind}: {v.value}
                  {v.secondary ? `/${v.secondary}` : ""} {v.unit}
                </span>
              ))}
            </div>
          )}
        </SummarySection>

        <SummarySection title={`Recent symptoms (last 30 days) - ${recentSymptoms.length}`}>
          {recentSymptoms.length === 0 ? (
            <p className="text-muted-foreground">None logged.</p>
          ) : (
            <ul className="space-y-1">
              {recentSymptoms.map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between border-b border-border/40 py-1 last:border-0"
                >
                  <span>{s.label}</span>
                  <span className="text-muted-foreground">severity {s.severity}/10</span>
                </li>
              ))}
            </ul>
          )}
        </SummarySection>

        <SummarySection title="Questions worth asking">
          {questions.length === 0 ? (
            <p className="text-muted-foreground">Nothing flagged right now.</p>
          ) : (
            <ul className="list-disc pl-4 space-y-1">
              {questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          )}
        </SummarySection>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-full" onClick={copySummary}>
          <ClipboardCopy className="mr-1.5 h-4 w-4" /> Copy to clipboard
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" /> Print
        </Button>
      </div>
    </div>
  );
}

function ConditionsEditor({ conditions }: { conditions: Condition[] }) {
  const addCondition = useAddCondition();
  const deleteCondition = useDeleteCondition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Condition["status"]>("active");

  function submit() {
    if (!name.trim()) return;
    addCondition.mutate(
      { name: name.trim(), status },
      {
        onSuccess: () => {
          setName("");
          setStatus("active");
          setAdding(false);
        },
      },
    );
  }

  return (
    <div className="space-y-2">
      {conditions.length === 0 && !adding ? (
        <p className="text-muted-foreground">None on file.</p>
      ) : null}
      {conditions.length > 0 && (
        <ul className="space-y-1">
          {conditions.map((c) => (
            <li
              key={c.id}
              className="group flex items-center justify-between border-b border-border/40 py-1 last:border-0"
            >
              <span>{c.name}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {c.status}
                <button
                  type="button"
                  aria-label={`Remove ${c.name}`}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-pointer"
                  onClick={() => deleteCondition.mutate(c.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Condition name"
            className="h-8 max-w-[180px] text-xs"
            autoFocus
          />
          <Select value={status} onValueChange={(v) => setStatus(v as Condition["status"])}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="chronic">Chronic</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 rounded-full"
            disabled={!name.trim() || addCondition.isPending}
            onClick={submit}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-full"
            onClick={() => setAdding(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 rounded-full text-xs text-primary"
          onClick={() => setAdding(true)}
        >
          <Plus className="mr-1 h-3 w-3" /> Add condition
        </Button>
      )}
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-medium">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function buildSummaryText({
  records,
  flagged,
  activeConditions,
  medications,
  latestVitals,
  recentSymptoms,
  questions,
}: {
  records: { id: string; title: string; date: string }[];
  flagged: { name: string; value: number; unit: string; range: string; status: string }[];
  activeConditions: Condition[];
  medications: Medication[];
  latestVitals: VitalEntry[];
  recentSymptoms: SymptomEntry[];
  questions: string[];
}) {
  const lines = [
    "Clinical Summary",
    `Generated ${new Date().toLocaleDateString()}`,
    `Records on file: ${records.length}`,
    "",
    `Active conditions (${activeConditions.length}):`,
    ...(activeConditions.length
      ? activeConditions.map((c) => `- ${c.name} (${c.status})`)
      : ["- None"]),
    "",
    `Current medications (${medications.length}):`,
    ...(medications.length
      ? medications.map(
          (m) => `- ${m.name}${m.dose ? ` - ${m.dose}` : ""} (${m.adherence}% adherence)`,
        )
      : ["- None"]),
    "",
    `Flagged lab markers (${flagged.length}):`,
    ...(flagged.length
      ? flagged.map((m) => `- ${m.name}: ${m.value} ${m.unit} (range ${m.range}, ${m.status})`)
      : ["- None"]),
    "",
    "Latest vitals:",
    ...(latestVitals.length
      ? latestVitals.map(
          (v) => `- ${v.kind}: ${v.value}${v.secondary ? `/${v.secondary}` : ""} ${v.unit}`,
        )
      : ["- None logged"]),
    "",
    `Recent symptoms (${recentSymptoms.length}):`,
    ...(recentSymptoms.length
      ? recentSymptoms.map((s) => `- ${s.label} (severity ${s.severity}/10)`)
      : ["- None logged"]),
    "",
    "Questions worth asking:",
    ...(questions.length ? questions.map((q) => `- ${q}`) : ["- None flagged"]),
  ];
  return lines.join("\n");
}

function PortabilitySection() {
  const cards = [
    {
      icon: FileStack,
      title: "Full export",
      desc: "Download everything Raag has stored about you.",
      cta: "Manage export",
    },
    {
      icon: ShieldOff,
      title: "Revoke sharing",
      desc: "Cut off access for care team members or apps.",
      cta: "Manage sharing",
    },
    {
      icon: Trash2,
      title: "Delete everything",
      desc: "Permanently remove your account and all data.",
      cta: "Manage deletion",
    },
  ];
  return (
    <Reveal delay={0.1}>
      <div>
        <h2 className="font-display text-xl mb-3">Portability & rights</h2>
        <Stagger className="grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <StaggerItem key={c.title}>
              <Link to="/settings">
                <Card className="rounded-3xl border-border/60 h-full hover:-translate-y-0.5 transition">
                  <CardContent className="p-5 space-y-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10">
                      <c.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="font-semibold text-sm">{c.title}</div>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Check className="h-3.5 w-3.5" /> {c.cta}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Reveal>
  );
}

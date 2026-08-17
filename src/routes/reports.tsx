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
  Printer,
  ShieldOff,
  Smile,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AsyncBoundary, LoadingRows } from "@/components/data-states";
import { motion, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useLabMarkers, useRecords, useRequestReport } from "@/lib/queries";
import type { ReportRequest } from "@/lib/types";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports & Data Export · Atlas Health" },
      { name: "description", content: "Build custom reports, preview a doctor visit summary, and manage data portability." },
      { property: "og:title", content: "Reports & Data Export · Atlas Health" },
      { property: "og:description", content: "Export, summarize, and control your Atlas Health data." },
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

const FORMAT_OPTIONS: { key: ReportRequest["format"]; label: string; desc: string; icon: typeof FileText }[] = [
  { key: "pdf", label: "PDF", desc: "Clean, printable document for you or a provider.", icon: FileText },
  { key: "json", label: "JSON", desc: "Structured data for backups or your own tools.", icon: FileJson },
  { key: "fhir", label: "FHIR R4 bundle", desc: "Interoperable format for clinical systems.", icon: FileStack },
];

function ReportsPage() {
  return (
    <AppShell title="Reports & Data Export" subtitle="Build reports, preview a visit summary, and manage your data.">
      <div className="space-y-8">
        <BuildReportSection />
        <DoctorSummarySection />
        <PortabilitySection />
        <p className="text-xs text-muted-foreground">
          Informational only — not medical advice. Reports summarize the data you've entered or connected and may not
          be complete or clinically validated.
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
            <p className="text-sm text-muted-foreground mt-1">Choose what to include, a date range, and a format.</p>
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
                        active ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <Checkbox checked={active} onCheckedChange={() => toggleScope(opt.key)} aria-label={opt.label} />
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
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ReportRequest["format"])} className="grid gap-3 sm:grid-cols-3">
              {FORMAT_OPTIONS.map((opt) => (
                <Label
                  key={opt.key}
                  htmlFor={`format-${opt.key}`}
                  className={`flex flex-col gap-2 rounded-2xl border p-4 cursor-pointer transition-colors ${
                    format === opt.key ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
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

function DoctorSummarySection() {
  const recordsQuery = useRecords();
  const labsQuery = useLabMarkers();

  return (
    <Reveal delay={0.05}>
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="font-display text-xl">Doctor visit summary</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A one-page snapshot you can bring to an appointment.
            </p>
          </div>
          <AsyncBoundary query={recordsQuery} skeleton={<LoadingRows count={2} />}>
            {(records) => (
              <AsyncBoundary query={labsQuery} skeleton={<LoadingRows count={2} />}>
                {(labs) => <SummaryPreview records={records} labs={labs} />}
              </AsyncBoundary>
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>
    </Reveal>
  );
}

function SummaryPreview({
  records,
  labs,
}: {
  records: { id: string; title: string; date: string }[];
  labs: { name: string; value: number; unit: string; range: string; status: string }[];
}) {
  const flagged = useMemo(() => labs.filter((l) => l.status === "high" || l.status === "low" || l.status === "critical"), [labs]);

  async function copySummary() {
    const text = buildSummaryText(records.length, flagged);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <div>
      <div id="print-summary" className="rounded-2xl border border-border/60 bg-muted/20 p-5 text-sm space-y-3">
        <div className="font-display text-lg">Clinical Summary</div>
        <div className="text-xs text-muted-foreground">Generated {new Date().toLocaleDateString()}</div>
        <div>
          <div className="font-medium">Records on file</div>
          <p className="text-muted-foreground">{records.length} medical records available for review.</p>
        </div>
        <div>
          <div className="font-medium">Flagged lab markers ({flagged.length})</div>
          {flagged.length === 0 ? (
            <p className="text-muted-foreground">No markers currently out of range.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {flagged.map((m) => (
                <li key={m.name} className="flex justify-between border-b border-border/40 py-1 last:border-0">
                  <span>{m.name}</span>
                  <span className="text-muted-foreground">
                    {m.value} {m.unit} · range {m.range} · {m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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

function buildSummaryText(recordCount: number, flagged: { name: string; value: number; unit: string; range: string; status: string }[]) {
  const lines = [
    "Clinical Summary",
    `Generated ${new Date().toLocaleDateString()}`,
    "",
    `Records on file: ${recordCount}`,
    "",
    `Flagged lab markers (${flagged.length}):`,
    ...(flagged.length
      ? flagged.map((m) => `- ${m.name}: ${m.value} ${m.unit} (range ${m.range}, ${m.status})`)
      : ["- None"]),
  ];
  return lines.join("\n");
}

function PortabilitySection() {
  const cards = [
    { icon: FileStack, title: "Full export", desc: "Download everything Atlas has stored about you.", cta: "Manage export" },
    { icon: ShieldOff, title: "Revoke sharing", desc: "Cut off access for care team members or apps.", cta: "Manage sharing" },
    { icon: Trash2, title: "Delete everything", desc: "Permanently remove your account and all data.", cta: "Manage deletion" },
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

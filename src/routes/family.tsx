import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AsyncBoundary, EmptyState } from "@/components/data-states";
import { Reveal, Stagger, StaggerItem, motion } from "@/components/motion";
import {
  useFamilyHistory,
  useRisks,
  useHouseholdMembers,
  useAddDependent,
  useAccessGrants,
  useGrantAccess,
  useRevokeAccessGrant,
} from "@/lib/queries";
import type { FamilyMember, RiskFactor, HouseholdMember } from "@/lib/types";
import { Ban, ChevronDown, Lightbulb, Plus, Share2, UserPlus, Users } from "lucide-react";
import { useState } from "react";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Family History & Risk - Raag" },
      { name: "description", content: "Understand inherited risk. Act early." },
      { property: "og:title", content: "Family History & Risk - Raag" },
      { property: "og:description", content: "Understand inherited risk. Act early." },
    ],
  }),
  component: Family,
});

const LEVEL_TONE: Record<string, string> = {
  Low: "bg-success/20 text-success-foreground border-success/30",
  Moderate: "bg-warning/20 text-warning-foreground border-warning/30",
  Elevated: "bg-destructive/15 text-destructive border-destructive/30",
  High: "bg-destructive/15 text-destructive border-destructive/30",
};

function groupRelation(relation: string): "Paternal" | "Maternal" | "Siblings" | "Other" {
  const r = relation.toLowerCase();
  if (r.includes("father") || r.includes("paternal") || (r.includes("uncle") && r.includes("dad")))
    return "Paternal";
  if (r.includes("mother") || r.includes("maternal")) return "Maternal";
  if (r.includes("sister") || r.includes("brother") || r.includes("sibling")) return "Siblings";
  if (r.includes("paternal grand")) return "Paternal";
  if (r.includes("maternal grand")) return "Maternal";
  return "Other";
}

function Family() {
  const familyQuery = useFamilyHistory();
  const risksQuery = useRisks();
  const householdQuery = useHouseholdMembers();

  return (
    <AppShell
      title="Family History & Risk"
      subtitle="Understand inherited risk. Act early."
      actions={<AddDependentDialog />}
    >
      <Card className="rounded-3xl border-border/60 mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-1">
            <Users className="h-4 w-4 text-primary" /> Your household
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            People you manage records for, with a live risk snapshot for each. Click anyone to
            manage who else has access to their records.
          </p>
          <AsyncBoundary
            query={householdQuery}
            empty={<EmptyState icon={Users} title="Couldn't load your household" />}
          >
            {(members) => <HouseholdGraph members={members} />}
          </AsyncBoundary>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Users className="h-4 w-4 text-primary" /> Family tree
            </div>
            <AsyncBoundary
              query={familyQuery}
              empty={<EmptyState icon={Users} title="No family history recorded" />}
            >
              {(members) => <FamilyTree members={members} />}
            </AsyncBoundary>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <AsyncBoundary
            query={risksQuery}
            empty={<EmptyState icon={Lightbulb} title="No risk factors identified yet" />}
          >
            {(risks) => <RiskList risks={risks} />}
          </AsyncBoundary>
          <p className="text-[11px] text-muted-foreground text-center">
            Risk levels are directional estimates based on your inputs, not diagnoses. Informational
            only - not medical advice.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

const RISK_DOT: Record<HouseholdMember["riskLevel"], string> = {
  None: "bg-muted-foreground/40",
  Low: "bg-success",
  Moderate: "bg-warning",
  Elevated: "bg-destructive",
  High: "bg-destructive",
};

/**
 * Pure-CSS org-chart layout (vertical/horizontal connector divs, no SVG
 * measurement or graph library needed) - "you" as the root, dependents as
 * children. A real graph over the actual access_grants/health_subjects
 * permission system, not a decorative mockup: clicking a node opens who
 * actually has access to that person's records.
 */
function HouseholdGraph({ members }: { members: HouseholdMember[] }) {
  const self = members.find((m) => m.kind === "self");
  const dependents = members.filter((m) => m.kind === "dependent");

  return (
    <div className="flex flex-col items-center py-2">
      {self && <HouseholdNode member={self} />}
      {dependents.length > 0 && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-6">
            {dependents.map((d) => (
              <div key={d.id} className="flex flex-col items-center">
                <div className="w-px h-6 bg-border" />
                <HouseholdNode member={d} />
              </div>
            ))}
          </div>
        </>
      )}
      {dependents.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Add a dependent (a child or a parent you help manage care for) to see them here.
        </p>
      )}
    </div>
  );
}

function HouseholdNode({ member }: { member: HouseholdMember }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-5 py-4 transition hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer"
      >
        <div className="relative">
          <div className="grid h-12 w-12 place-items-center rounded-full gradient-primary text-white text-sm font-semibold shadow-soft">
            {initials(member.name)}
          </div>
          <span
            className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${RISK_DOT[member.riskLevel]}`}
          />
        </div>
        <div className="text-center">
          <div className="text-sm font-medium">{member.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {member.kind === "self" ? "You" : member.relation || "Dependent"}
            {member.age !== undefined ? ` · ${member.age}y` : ""}
          </div>
        </div>
        {member.riskLevel !== "None" && (
          <Badge variant="outline" className="rounded-full text-[10px]">
            {member.riskLevel} risk{member.topRiskFactor ? ` · ${member.topRiskFactor}` : ""}
          </Badge>
        )}
      </button>
      <ManageAccessDialog member={member} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ManageAccessDialog({
  member,
  open,
  onOpenChange,
}: {
  member: HouseholdMember;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const grantsQuery = useAccessGrants(member.id);
  const grantAccess = useGrantAccess();
  const revoke = useRevokeAccessGrant();
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<"summary" | "full">("summary");

  function submit() {
    if (!email.trim()) return;
    grantAccess.mutate(
      { subjectId: member.id, granteeEmail: email.trim(), scope },
      { onSuccess: () => setEmail("") },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Who has access to {member.name}'s records</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <AsyncBoundary
            query={grantsQuery}
            empty={<p className="text-xs text-muted-foreground">Only you have access right now.</p>}
          >
            {(grants) => {
              const active = grants.filter((g) => !g.revokedAt);
              return active.length === 0 ? (
                <p className="text-xs text-muted-foreground">Only you have access right now.</p>
              ) : (
                <div className="space-y-2">
                  {active.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{g.granteeName}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {g.granteeEmail}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          {g.scope === "full" ? "Full access" : "View only"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => revoke.mutate({ id: g.id, subjectId: member.id })}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }}
          </AsyncBoundary>

          <div className="rounded-2xl border border-dashed border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Share2 className="h-3.5 w-3.5 text-primary" /> Share access
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Their email (must already have a Raag account)</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="family@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Access level</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "summary" | "full")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">View only</SelectItem>
                  <SelectItem value="full">Full access (can edit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="w-full rounded-full gradient-primary text-white border-0"
              disabled={grantAccess.isPending || !email.trim()}
              onClick={submit}
            >
              Grant access
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDependentDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const addDependent = useAddDependent();

  function submit() {
    if (!name.trim()) return;
    addDependent.mutate(
      {
        name: name.trim(),
        relation: relation.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setRelation("");
          setDateOfBirth("");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary text-white border-0">
          <UserPlus className="mr-1.5 h-4 w-4" /> Add dependent
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a dependent</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya Morgan"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Relation</Label>
            <Input
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="e.g. Daughter, Father"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Date of birth (optional)</Label>
            <Input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={addDependent.isPending || !name.trim()}
            className="rounded-full gradient-primary text-white border-0"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FamilyTree({ members }: { members: FamilyMember[] }) {
  const groups: Record<string, FamilyMember[]> = {
    Paternal: [],
    Maternal: [],
    Siblings: [],
    Other: [],
  };
  members.forEach((m) => groups[groupRelation(m.relation)].push(m));

  return (
    <div className="space-y-5">
      {(["Paternal", "Maternal", "Siblings", "Other"] as const).map((groupName) =>
        groups[groupName].length > 0 ? (
          <div key={groupName}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              {groupName}
            </div>
            <Stagger className="space-y-2">
              {groups[groupName].map((f) => (
                <StaggerItem key={f.relation}>
                  <div className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{f.relation}</div>
                      <div className="text-xs text-muted-foreground">Age {f.age}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.conditions.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-accent/70 border border-border"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        ) : null,
      )}
    </div>
  );
}

function RiskList({ risks }: { risks: RiskFactor[] }) {
  return (
    <div className="space-y-4">
      {risks.map((r, i) => (
        <RiskCard key={r.name} risk={r} delay={i * 0.06} />
      ))}
    </div>
  );
}

function RiskCard({ risk, delay }: { risk: RiskFactor; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={delay}>
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{risk.name}</div>
            <Badge className={`rounded-full text-[10px] ${LEVEL_TONE[risk.level] ?? ""}`}>
              {risk.level} risk
            </Badge>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={`h-full ${risk.level === "Elevated" || risk.level === "High" ? "bg-destructive" : risk.level === "Moderate" ? "bg-warning" : "bg-success"}`}
              initial={{ width: 0 }}
              animate={{ width: `${risk.pct}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{risk.note}</p>

          <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-7 px-2 text-xs text-primary"
              >
                What you can do
                <ChevronDown
                  className={`ml-1 h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                <span className="font-medium text-primary">Consider:</span> {risk.action}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </Reveal>
  );
}

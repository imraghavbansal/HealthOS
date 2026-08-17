import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AsyncBoundary, EmptyState } from "@/components/data-states";
import { AnimatedNumber, ProgressRing, Stagger, StaggerItem, motion } from "@/components/motion";
import { useAddMedication, useLogDose, useMedications } from "@/lib/queries";
import type { Medication } from "@/lib/types";
import { AlertTriangle, Bell, Check, Pill, Plus, X } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/medications")({
  head: () => ({
    meta: [
      { title: "Medications & Supplements — Atlas Health" },
      { name: "description", content: "Reminders, adherence, and interaction awareness." },
      { property: "og:title", content: "Medications & Supplements — Atlas Health" },
      { property: "og:description", content: "Reminders, adherence, and interaction awareness." },
    ],
  }),
  component: Medications,
});

function Medications() {
  const medsQuery = useMedications();
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      title="Medications & Supplements"
      subtitle="Reminders, adherence, and interaction awareness."
      actions={<AddMedicationDialog open={open} onOpenChange={setOpen} />}
    >
      <AsyncBoundary
        query={medsQuery}
        empty={<EmptyState icon={Pill} title="No medications yet" body="Add a medication or supplement to start tracking." />}
      >
        {(meds) => <MedicationsBody meds={meds} />}
      </AsyncBoundary>
    </AppShell>
  );
}

function AddMedicationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const add = useAddMedication();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [schedule, setSchedule] = useState("");
  const [type, setType] = useState<"Supplement" | "Prescription">("Supplement");
  const [next, setNext] = useState("");

  const reset = () => {
    setName("");
    setDose("");
    setSchedule("");
    setType("Supplement");
    setNext("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary text-white border-0">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add medication or supplement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="med-name">Name</Label>
            <Input id="med-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vitamin D3" />
          </div>
          <div>
            <Label htmlFor="med-dose">Dose</Label>
            <Input id="med-dose" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="1000 IU" />
          </div>
          <div>
            <Label htmlFor="med-schedule">Schedule</Label>
            <Input id="med-schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Daily, with breakfast" />
          </div>
          <div>
            <Label htmlFor="med-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "Supplement" | "Prescription")}>
              <SelectTrigger id="med-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Supplement">Supplement</SelectItem>
                <SelectItem value="Prescription">Prescription</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="med-next">Next dose</Label>
            <Input id="med-next" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Tomorrow, 8:00 AM" />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="rounded-full gradient-primary text-white border-0"
            disabled={!name || !dose || add.isPending}
            onClick={() => {
              add.mutate(
                { name, dose, schedule, type, next },
                {
                  onSuccess: () => {
                    reset();
                    onOpenChange(false);
                  },
                },
              );
            }}
          >
            Save medication
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MedicationsBody({ meds }: { meds: Medication[] }) {
  const logDose = useLogDose();
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());
  const avgAdherence = meds.length ? Math.round(meds.reduce((s, m) => s + m.adherence, 0) / meds.length) : 0;
  const anyWarnings = meds.filter((m) => (m.interactions?.length ?? 0) > 0 || (m.refillsLeft ?? 99) <= 3);

  return (
    <div className="space-y-6">
      <div>
        <div className="font-display text-lg mb-3">Today's schedule</div>
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meds.map((m) => {
            const taken = takenIds.has(m.id);
            return (
              <StaggerItem key={m.id}>
                <Card className="rounded-3xl border-border/60 h-full">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl gradient-primary grid place-items-center text-white shrink-0">
                        <Pill className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{m.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{m.dose} · {m.next}</div>
                      </div>
                    </div>
                    {taken ? (
                      <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 18 }}
                        className="flex items-center justify-center gap-2 rounded-full bg-success/15 text-success-foreground py-2 text-sm font-medium"
                      >
                        <Check className="h-4 w-4" /> Taken
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          className="rounded-full gradient-primary text-white border-0 h-10"
                          disabled={logDose.isPending}
                          onClick={() => {
                            setTakenIds((s) => new Set(s).add(m.id));
                            logDose.mutate({ id: m.id, taken: true });
                          }}
                        >
                          <Check className="mr-1 h-4 w-4" /> Taken
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-10"
                          disabled={logDose.isPending}
                          onClick={() => logDose.mutate({ id: m.id, taken: false })}
                        >
                          <X className="mr-1 h-4 w-4" /> Skip
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-3">
          {meds.map((m) => {
            const warn = (m.interactions?.length ?? 0) > 0 || (m.refillsLeft ?? 99) <= 3;
            return (
              <Card key={m.id} className="rounded-3xl border-border/60">
                <CardContent className="p-5 grid md:grid-cols-[auto_1fr_auto] items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl gradient-primary grid place-items-center text-white">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{m.name}</div>
                      <Badge variant="secondary" className="rounded-full text-[10px]">{m.type}</Badge>
                      {warn && (
                        <Badge className="rounded-full text-[10px] bg-warning/20 text-warning-foreground border-warning/30">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {(m.interactions?.length ?? 0) > 0 ? "Interaction" : "Refill low"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.dose} · {m.schedule}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Bell className="h-3 w-3" /> Next: {m.next}
                      {m.refillsLeft !== undefined && <span> · {m.refillsLeft} refills left</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressRing
                      value={m.adherence}
                      size={64}
                      stroke={6}
                      label={
                        <div className="text-xs font-semibold">
                          <AnimatedNumber value={m.adherence} suffix="%" />
                        </div>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="space-y-4">
          <Card className="rounded-3xl border-border/60 gradient-hero">
            <CardContent className="p-5">
              <div className="text-sm font-semibold">Average adherence</div>
              <div className="font-display text-5xl mt-2">
                <AnimatedNumber value={avgAdherence} />
                <span className="text-lg text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Across {meds.length} tracked medications.</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-5">
              {anyWarnings.length === 0 ? (
                <>
                  <div className="text-sm font-semibold mb-2">No known interactions</div>
                  <p className="text-xs text-muted-foreground">
                    Atlas checks your active meds against a curated interaction database on every update.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-warning-foreground">
                    <AlertTriangle className="h-4 w-4" /> Needs attention
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {anyWarnings.map((m) => (
                      <li key={m.id}>
                        {m.name}: {(m.interactions?.length ?? 0) > 0 ? m.interactions?.join(", ") : `${m.refillsLeft} refills left`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">Informational only — not medical advice.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

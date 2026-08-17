import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AsyncBoundary, EmptyState, LoadingCards, LoadingRows } from "@/components/data-states";
import { Lift, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAddAppointment,
  useAppointments,
  useCancelAppointment,
  useCareTeam,
  useSetCareSharing,
} from "@/lib/queries";
import type { Appointment, CareTeamMember } from "@/lib/types";
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  Video,
} from "lucide-react";

export const Route = createFileRoute("/appointments")({
  component: AppointmentsPage,
  head: () => ({
    meta: [
      { title: "Appointments & Care — Orvana" },
      { name: "description", content: "Manage upcoming visits, past care, and your care team." },
      { property: "og:title", content: "Appointments & Care — Orvana" },
      { property: "og:description", content: "Manage upcoming visits, past care, and your care team." },
    ],
  }),
});

const MODE_ICON: Record<Appointment["mode"], typeof MapPin> = {
  "in-person": MapPin,
  video: Video,
  phone: Phone,
};

const MODE_LABEL: Record<Appointment["mode"], string> = {
  "in-person": "In-person",
  video: "Video",
  phone: "Phone",
};

function AppointmentsPage() {
  const appointments = useAppointments();
  const careTeam = useCareTeam();

  return (
    <AppShell
      title="Appointments & Care"
      subtitle="Everything scheduled, in one calm view."
      actions={<ScheduleDialog />}
    >
      <div className="space-y-6">
        <Tabs defaultValue="upcoming">
          <TabsList className="rounded-full">
            <TabsTrigger value="upcoming" className="rounded-full">Upcoming</TabsTrigger>
            <TabsTrigger value="past" className="rounded-full">Past</TabsTrigger>
            <TabsTrigger value="care" className="rounded-full">Care team</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-5">
            <AsyncBoundary query={appointments} skeleton={<LoadingCards count={3} />}>
              {(data) => <UpcomingList appointments={data.filter((a) => a.status === "upcoming")} />}
            </AsyncBoundary>
          </TabsContent>

          <TabsContent value="past" className="mt-5">
            <AsyncBoundary query={appointments} skeleton={<LoadingRows count={4} />}>
              {(data) => <PastList appointments={data.filter((a) => a.status !== "upcoming")} />}
            </AsyncBoundary>
          </TabsContent>

          <TabsContent value="care" className="mt-5">
            <AsyncBoundary query={careTeam} skeleton={<LoadingCards count={3} />}>
              {(data) => <CareTeamList members={data} />}
            </AsyncBoundary>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">Informational only — not medical advice.</p>
      </div>
    </AppShell>
  );
}

function daysUntil(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return "past";
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

function buildIcs(a: Appointment) {
  const start = new Date(a.start);
  const end = new Date(start.getTime() + a.durationMin * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Orvana//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${a.id}@orvana`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${a.title}`,
    `DESCRIPTION:${a.provider} · ${a.specialty}`,
    `LOCATION:${a.location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function UpcomingList({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return <EmptyState icon={CalendarDays} title="No upcoming appointments" body="Use “Schedule” to book your next visit." />;
  }

  const sorted = [...appointments].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <Stagger className="grid gap-4 lg:grid-cols-2">
      {sorted.map((a) => (
        <StaggerItem key={a.id}>
          <AppointmentCard appointment={a} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const cancelAppointment = useCancelAppointment();
  const [notesOpen, setNotesOpen] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const ModeIcon = MODE_ICON[appointment.mode];
  const start = new Date(appointment.start);

  function downloadIcs() {
    const ics = buildIcs(appointment);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${appointment.title.replace(/\s+/g, "-").toLowerCase()}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Lift>
      <Card className="rounded-3xl border-border/60 h-full">
        <CardContent className="p-5">
          <div className="flex gap-4">
            <div className="shrink-0 rounded-2xl bg-primary/10 text-primary w-16 h-16 flex flex-col items-center justify-center">
              <div className="text-xl font-display leading-none">{start.getDate()}</div>
              <div className="text-[10px] uppercase tracking-wide">
                {start.toLocaleString(undefined, { month: "short" })}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold truncate">{appointment.title}</div>
                <Badge variant="secondary" className="rounded-full text-[10px] shrink-0">{daysUntil(appointment.start)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {appointment.provider} · {appointment.specialty}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge className="rounded-full text-[10px] bg-muted text-muted-foreground gap-1">
                  <ModeIcon className="h-3 w-3" /> {MODE_LABEL[appointment.mode]}
                </Badge>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {appointment.durationMin} min</span>
                {appointment.mode !== "phone" && (
                  <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {appointment.location}</span>
                )}
              </div>
            </div>
          </div>

          {appointment.prepNotes && appointment.prepNotes.length > 0 && (
            <Collapsible open={notesOpen} onOpenChange={setNotesOpen} className="mt-4">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Prep notes ({appointment.prepNotes.length})</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${notesOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {appointment.prepNotes.map((note, i) => (
                  <label key={i} className="flex items-start gap-2 text-xs">
                    <Checkbox
                      checked={!!checked[i]}
                      onCheckedChange={(v) => setChecked((c) => ({ ...c, [i]: !!v }))}
                    />
                    <span className={checked[i] ? "line-through text-muted-foreground" : ""}>{note}</span>
                  </label>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={downloadIcs}>
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Add to calendar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="rounded-full text-destructive hover:text-destructive">
                  Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel “{appointment.title}” with {appointment.provider} on{" "}
                    {start.toLocaleDateString()}. You can always reschedule later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-full">Keep appointment</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-full bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => cancelAppointment.mutate(appointment.id)}
                  >
                    Yes, cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </Lift>
  );
}

function PastList({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return <EmptyState icon={CalendarDays} title="No past appointments" body="Your appointment history will show up here." />;
  }
  const sorted = [...appointments].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  return (
    <div className="space-y-2">
      {sorted.map((a) => (
        <Card key={a.id} className="rounded-2xl border-border/60 bg-muted/20">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{a.title}</div>
              <div className="text-xs text-muted-foreground">
                {a.provider} · {new Date(a.start).toLocaleDateString()}
              </div>
            </div>
            <Badge
              variant="secondary"
              className={`rounded-full text-[10px] shrink-0 ${a.status === "cancelled" ? "text-destructive" : ""}`}
            >
              {a.status}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CareTeamList({ members }: { members: CareTeamMember[] }) {
  if (members.length === 0) {
    return <EmptyState icon={Stethoscope} title="No care team members" body="Providers you connect with will appear here." />;
  }
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((m) => (
        <StaggerItem key={m.id}>
          <CareTeamCard member={m} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function CareTeamCard({ member }: { member: CareTeamMember }) {
  const setSharing = useSetCareSharing();
  return (
    <Lift>
      <Card className="rounded-3xl border-border/60 h-full">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">{member.name}</div>
              <div className="text-xs text-muted-foreground">{member.role} · {member.org}</div>
            </div>
            <div className="h-9 w-9 rounded-xl gradient-primary grid place-items-center text-white shrink-0">
              <Stethoscope className="h-4 w-4" />
            </div>
          </div>
          <a href={`tel:${member.phone}`} className="text-xs text-primary hover:underline flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> {member.phone}
          </a>
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Share my Orvana summary
            </div>
            <Switch
              checked={member.sharing}
              onCheckedChange={(v) => setSharing.mutate({ id: member.id, sharing: v })}
              aria-label={`Toggle sharing for ${member.name}`}
            />
          </div>
        </CardContent>
      </Card>
    </Lift>
  );
}

function ScheduleDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [datetime, setDatetime] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState<Appointment["mode"]>("in-person");
  const addAppointment = useAddAppointment();

  const isoStart = useMemo(() => (datetime ? new Date(datetime).toISOString() : ""), [datetime]);

  function reset() {
    setTitle("");
    setProvider("");
    setSpecialty("");
    setDatetime("");
    setDurationMin("30");
    setLocation("");
    setMode("in-person");
  }

  function submit() {
    if (!title.trim() || !provider.trim() || !isoStart) return;
    addAppointment.mutate(
      {
        title: title.trim(),
        provider: provider.trim(),
        specialty: specialty.trim() || "General",
        start: isoStart,
        durationMin: Number(durationMin) || 30,
        location: location.trim() || "TBD",
        mode,
        prepNotes: [],
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary text-white border-0">
          <CalendarPlus className="mr-1.5 h-4 w-4" /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule an appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="appt-title">Title</Label>
            <Input id="appt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Annual physical" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="appt-provider">Provider</Label>
              <Input id="appt-provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Dr. Chen" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appt-specialty">Specialty</Label>
              <Input id="appt-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Cardiology" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="appt-datetime">Date & time</Label>
            <Input id="appt-datetime" type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="appt-duration">Duration (min)</Label>
              <Input id="appt-duration" type="number" min={5} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appt-mode">Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Appointment["mode"])}>
                <SelectTrigger id="appt-mode" className="rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-person">In-person</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="appt-location">Location</Label>
            <Input id="appt-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Orvana Clinic, Suite 200" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full gradient-primary text-white border-0"
            disabled={!title.trim() || !provider.trim() || !isoStart || addAppointment.isPending}
            onClick={submit}
          >
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

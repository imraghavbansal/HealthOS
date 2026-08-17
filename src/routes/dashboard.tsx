import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpRight,
  Activity,
  CalendarClock,
  CheckCircle2,
  Circle,
  Moon,
  Pill,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useMemo, useState } from "react";
import {
  useProfile,
  useHealthScore,
  useInsights,
  useSleep,
  useActivity,
  useMedications,
  useGoals,
  useAppointments,
  useLogDose,
} from "@/lib/queries";
import { AsyncBoundary, EmptyState, LoadingCards, LoadingChart, LoadingRows } from "@/components/data-states";
import { AnimatedNumber, Lift, ProgressRing, Stagger, StaggerItem, motion } from "@/components/motion";
import type { Appointment, Medication } from "@/lib/types";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

type Range = "7d" | "30d" | "90d";
const RANGES: Range[] = ["7d", "30d", "90d"];

function Dashboard() {
  const profileQ = useProfile();
  const scoreQ = useHealthScore();
  const insightsQ = useInsights();
  const medsQ = useMedications();
  const goalsQ = useGoals();
  const apptsQ = useAppointments();

  const [range, setRange] = useState<Range>("7d");
  const sleepQ = useSleep(range);
  const activityQ = useActivity(range);

  // Derived from real medications/goals, not fabricated demo tasks. A
  // medication task's checkmark is a session-local visual confirmation —
  // clicking it does log a real dose via useLogDose — since "was today's
  // dose already logged" isn't in the medication summary shape (adherence
  // is computed over a trailing window, not per-day).
  const logDose = useLogDose();
  const nav = useNavigate();
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  const tasks = [
    ...(medsQ.data ?? []).slice(0, 3).map((m) => ({
      id: `med-${m.id}`,
      label: `Take ${m.name}${m.dose ? ` (${m.dose})` : ""}`,
      onSelect: () => logDose.mutate({ id: m.id, taken: true }),
    })),
    ...(goalsQ.data && goalsQ.data.length > 0
      ? [
          {
            id: "goal",
            label: `Check in on: ${[...goalsQ.data].sort((a, b) => a.progress - b.progress)[0]!.title}`,
            onSelect: () => nav({ to: "/goals" }),
          },
        ]
      : []),
    { id: "nutrition", label: "Log a meal today", onSelect: () => nav({ to: "/nutrition" }) },
  ].map((t) => ({ ...t, done: completedTaskIds.has(t.id) }));
  const doneCount = tasks.filter((t) => t.done).length;

  function handleTaskClick(id: string, onSelect: () => void) {
    setCompletedTaskIds((prev) => new Set(prev).add(id));
    onSelect();
  }

  const firstName = profileQ.data?.name.split(" ")[0] ?? "there";

  return (
    <AppShell
      title={`Good morning, ${firstName}.`}
      subtitle="Here's what changed while you slept."
      actions={<Button className="rounded-full gradient-primary text-white border-0">+ Log entry</Button>}
    >
      <Stagger className="grid xl:grid-cols-3 gap-4 md:gap-6">
        {/* Health Score */}
        <StaggerItem className="xl:col-span-1">
          <Lift className="h-full">
            <Card className="h-full rounded-3xl border-border/60 overflow-hidden relative">
              <div className="absolute inset-0 gradient-hero opacity-70" />
              <CardContent className="relative p-6">
                <AsyncBoundary query={scoreQ} skeleton={<LoadingCards count={1} className="grid" />}>
                  {(score) => (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium text-primary uppercase tracking-widest">Health Score</div>
                          <div className="mt-3 flex items-baseline gap-3">
                            <AnimatedNumber value={score.score} className="font-display text-7xl leading-none" />
                            <div className="text-sm text-success flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5" /> +{score.delta}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">Synced {score.lastSync}</div>
                        </div>
                        <ProgressRing value={score.score} size={90} stroke={8} />
                      </div>
                      <div className="mt-6 space-y-2.5">
                        {score.pillars.map((p) => (
                          <div key={p.label}>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-muted-foreground">{p.label}</span>
                              <span className="font-medium">{p.value}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className="h-full rounded-full gradient-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${p.value}%` }}
                                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </AsyncBoundary>
              </CardContent>
            </Card>
          </Lift>
        </StaggerItem>

        {/* Today's insights */}
        <StaggerItem className="xl:col-span-2">
          <Lift className="h-full">
            <Card className="h-full rounded-3xl border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" /> Today's AI insights
                  </div>
                  <Link to="/assistant" className="text-xs text-primary hover:underline flex items-center gap-1">
                    Ask Atlas <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <AsyncBoundary
                  query={insightsQ}
                  skeleton={<LoadingCards count={3} className="grid md:grid-cols-3 gap-3" />}
                  empty={<EmptyState title="No insights yet" body="Check back after your next sync." />}
                >
                  {(insights) => (
                    <div className="grid md:grid-cols-3 gap-3">
                      {insights.map((i) => {
                        const tone =
                          i.severity === "warning"
                            ? "bg-warning/15 text-warning-foreground border-warning/30"
                            : i.severity === "success"
                              ? "bg-success/15 text-success-foreground border-success/30"
                              : "bg-primary/10 text-foreground border-primary/20";
                        return (
                          <div key={i.id} className={`rounded-2xl border p-4 ${tone}`}>
                            <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{i.severity}</div>
                            <div className="mt-2 font-semibold text-sm">{i.title}</div>
                            <p className="mt-1 text-xs opacity-90 leading-relaxed">{i.body}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AsyncBoundary>
              </CardContent>
            </Card>
          </Lift>
        </StaggerItem>

        {/* Range switcher */}
        <StaggerItem className="xl:col-span-3 -mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Range:</span>
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs rounded-full px-3 py-1.5 transition ${
                  range === r ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent text-muted-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </StaggerItem>

        {/* Sleep */}
        <StaggerItem>
          <Lift className="h-full">
            <Card className="h-full rounded-3xl border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Moon className="h-4 w-4 text-primary" /> Sleep
                  </div>
                  <Badge variant="secondary" className="rounded-full text-[10px]">{range}</Badge>
                </div>
                <AsyncBoundary query={sleepQ} skeleton={<LoadingChart height={190} />}>
                  {(sleep) => {
                    const avg = sleep.length ? sleep.reduce((a, s) => a + s.hours, 0) / sleep.length : 0;
                    const h = Math.floor(avg);
                    const m = Math.round((avg - h) * 60);
                    return (
                      <>
                        <div className="flex items-baseline gap-2 mt-2">
                          <div className="font-display text-4xl">
                            {h}h {m}m
                          </div>
                        </div>
                        <div className={`h-36 mt-4 transition-opacity ${sleepQ.isFetching ? "opacity-50" : "opacity-100"}`}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sleep}>
                              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <Tooltip
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "1px solid var(--border)",
                                  background: "var(--popover)",
                                  fontSize: 12,
                                }}
                              />
                              <Bar dataKey="hours" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
                              <Bar dataKey="deep" fill="var(--color-chart-2)" radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    );
                  }}
                </AsyncBoundary>
              </CardContent>
            </Card>
          </Lift>
        </StaggerItem>

        {/* Activity */}
        <StaggerItem>
          <Lift className="h-full">
            <Card className="h-full rounded-3xl border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Activity className="h-4 w-4 text-primary" /> Activity
                  </div>
                  <Badge variant="secondary" className="rounded-full text-[10px]">{range}</Badge>
                </div>
                <AsyncBoundary query={activityQ} skeleton={<LoadingChart height={190} />}>
                  {(activity) => {
                    const avgSteps = activity.length
                      ? Math.round(activity.reduce((a, s) => a + s.steps, 0) / activity.length)
                      : 0;
                    return (
                      <>
                        <div className="flex items-baseline gap-2 mt-2">
                          <AnimatedNumber value={avgSteps} className="font-display text-4xl" />
                          <div className="text-xs text-muted-foreground">avg steps/day</div>
                        </div>
                        <div className={`h-36 mt-4 transition-opacity ${activityQ.isFetching ? "opacity-50" : "opacity-100"}`}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activity}>
                              <defs>
                                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <Tooltip
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "1px solid var(--border)",
                                  background: "var(--popover)",
                                  fontSize: 12,
                                }}
                              />
                              <Area type="monotone" dataKey="steps" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#grad1)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    );
                  }}
                </AsyncBoundary>
              </CardContent>
            </Card>
          </Lift>
        </StaggerItem>

        {/* Next up */}
        <StaggerItem>
          <Lift className="h-full">
            <Card className="h-full rounded-3xl border-border/60">
              <CardContent className="p-6">
                <div className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <CalendarClock className="h-4 w-4 text-primary" /> Next up
                </div>
                <AsyncBoundary
                  query={apptsQ}
                  skeleton={<LoadingRows count={2} />}
                >
                  {(appts) => (
                    <NextUp appointments={appts} medsQuery={medsQ} />
                  )}
                </AsyncBoundary>
              </CardContent>
            </Card>
          </Lift>
        </StaggerItem>

        {/* Today's Focus */}
        <StaggerItem className="xl:col-span-3">
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold flex items-center gap-2">
                  Today's focus
                  <Badge variant="secondary" className="rounded-full text-[10px]">{doneCount}/{tasks.length} done</Badge>
                </div>
                <span className="text-xs text-muted-foreground">Personalized by Atlas from your goals & trends</span>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    Add a medication or goal to see personalized focus items here.
                  </p>
                )}
                {tasks.map((t) => (
                  <button
                    key={t.id}
                    disabled={t.done}
                    onClick={() => handleTaskClick(t.id, t.onSelect)}
                    className={`flex items-center gap-3 rounded-2xl border border-border/60 p-3 text-left transition hover:bg-accent/40 ${
                      t.done ? "bg-success/10 border-success/30" : "bg-card/60"
                    }`}
                  >
                    {t.done ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <span className={`text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Goal snapshot */}
        <StaggerItem className="xl:col-span-3">
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold">Top goals</div>
                <Link to="/goals" className="text-xs text-primary hover:underline">Manage goals</Link>
              </div>
              <AsyncBoundary
                query={goalsQ}
                skeleton={<LoadingCards count={3} className="grid md:grid-cols-3 gap-3" />}
                empty={<EmptyState title="No goals yet" body="Create a goal to track progress here." />}
              >
                {(goals) => (
                  <div className="grid md:grid-cols-3 gap-3">
                    {goals.slice(0, 3).map((g) => (
                      <div key={g.id} className="rounded-2xl border border-border/60 p-4 bg-card/60">
                        <div className="text-sm font-medium">{g.title}</div>
                        <div className="mt-3 flex items-center gap-3">
                          <Progress value={g.progress} className="h-2" />
                          <span className="text-xs text-muted-foreground">{g.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AsyncBoundary>
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>
    </AppShell>
  );
}

function NextUp({
  appointments,
  medsQuery,
}: {
  appointments: Appointment[];
  medsQuery: ReturnType<typeof useMedications>;
}) {
  const nextAppt = useMemo(() => {
    const upcoming = appointments
      .filter((a) => a.status === "upcoming")
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return upcoming[0];
  }, [appointments]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Next appointment</div>
        {nextAppt ? (
          <>
            <div className="text-sm font-medium mt-1">{nextAppt.title}</div>
            <div className="text-xs text-muted-foreground">
              {nextAppt.provider} · {new Date(nextAppt.start).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground mt-1">Nothing scheduled</div>
        )}
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Pill className="h-3 w-3" /> Next dose
        </div>
        <AsyncBoundary query={medsQuery} skeleton={<LoadingRows count={1} />}>
          {(meds: Medication[]) => {
            const next = meds[0];
            return next ? (
              <>
                <div className="text-sm font-medium mt-1">{next.name} · {next.dose}</div>
                <div className="text-xs text-muted-foreground">{next.next}</div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground mt-1">No medications logged</div>
            );
          }}
        </AsyncBoundary>
      </div>
    </div>
  );
}

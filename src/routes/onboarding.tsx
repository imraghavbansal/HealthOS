import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, Heart, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { hasActiveSession } from "@/lib/auth";
import { IS_DEMO } from "@/lib/api";
import { getPushSubscriptionState, subscribeToPush } from "@/lib/push";
import {
  useUpdateProfile,
  useAddGoal,
  useAddFamilyMember,
  useAddMedication,
  useUpdateLifestyleProfile,
} from "@/lib/queries";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const STEPS = ["About you", "Your goals", "Family history", "Medications", "Lifestyle", "Devices"];
const GOAL_OPTIONS = [
  "Better sleep",
  "More energy",
  "Lose weight",
  "Build muscle",
  "Lower cholesterol",
  "Manage stress",
  "Longevity",
  "Fertility",
];

function PushNotificationPrompt() {
  const [state, setState] = useState<"loading" | "subscribed" | "unsubscribed" | "unsupported">(
    "loading",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushSubscriptionState().then(setState);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      await subscribeToPush();
      setState("subscribed");
      toast.success("Push notifications enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't enable push notifications");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5 flex items-start gap-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-primary text-white">
        <Bell className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {state === "subscribed" ? "Notifications enabled" : "Turn on notifications"}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Get notified about medication reminders, new insights, and out-of-range lab results - even
          when Raag isn't open. You can change this anytime in Settings.
        </p>
      </div>
      {state !== "subscribed" && (
        <Button
          size="sm"
          className="rounded-full gradient-primary text-white border-0 shrink-0"
          disabled={busy || state === "loading"}
          onClick={enable}
        >
          Enable
        </Button>
      )}
    </div>
  );
}

function Onboarding() {
  const [step, setStep] = useState(0);
  const [checkingSession, setCheckingSession] = useState(!IS_DEMO);
  const nav = useNavigate();
  const pct = ((step + 1) / STEPS.length) * 100;

  const updateProfile = useUpdateProfile();
  const addGoal = useAddGoal();
  const addFamilyMember = useAddFamilyMember();
  const addMedication = useAddMedication();
  const updateLifestyle = useUpdateLifestyleProfile();

  useEffect(() => {
    if (IS_DEMO) return;
    hasActiveSession().then((ok) => {
      if (!ok) {
        toast.error("Confirm your email first, then sign in to continue onboarding.");
        nav({ to: "/login" });
      } else {
        setCheckingSession(false);
      }
    });
  }, [nav]);

  // step-local form state
  const [about, setAbout] = useState({
    dateOfBirth: "",
    heightCm: "",
    weightKg: "",
    sex: "",
  });
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(
    new Set(GOAL_OPTIONS.slice(0, 3)),
  );
  const [family, setFamily] = useState([
    { relation: "Mother", conditions: "" },
    { relation: "Father", conditions: "" },
    { relation: "Siblings", conditions: "" },
  ]);
  const [meds, setMeds] = useState([{ name: "", dose: "", schedule: "" }]);
  const [lifestyle, setLifestyle] = useState({
    alcohol: "Occasionally",
    smoking: "Never",
    exercise: "Moderate",
    diet: "Omnivore",
  });

  async function finishStepAndAdvance() {
    try {
      if (step === 0) {
        if (!about.dateOfBirth || !about.sex) {
          toast.error("Date of birth and sex at birth are required to continue.");
          return;
        }
        await updateProfile.mutateAsync({
          dateOfBirth: about.dateOfBirth || undefined,
          heightCm: about.heightCm ? Number(about.heightCm) : undefined,
          weightKg: about.weightKg ? Number(about.weightKg) : undefined,
          sex: about.sex,
        });
      } else if (step === 1) {
        await Promise.all(
          [...selectedGoals].map((title) => addGoal.mutateAsync({ title, category: "general" })),
        );
      } else if (step === 2) {
        const entries = family.filter((f) => f.conditions.trim());
        await Promise.all(
          entries.map((f) =>
            addFamilyMember.mutateAsync({
              relation: f.relation,
              conditions: f.conditions
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean),
              age: 0,
            }),
          ),
        );
      } else if (step === 3) {
        const entries = meds.filter((m) => m.name.trim());
        await Promise.all(
          entries.map((m) =>
            addMedication.mutateAsync({
              name: m.name.trim(),
              dose: m.dose.trim(),
              schedule: m.schedule.trim(),
              type: "Supplement",
              next: "-",
            }),
          ),
        );
      } else if (step === 4) {
        await updateLifestyle.mutateAsync(lifestyle);
      } else if (step === STEPS.length - 1) {
        await updateProfile.mutateAsync({ onboardingCompleted: true });
        toast.success("You're all set 👋");
        nav({ to: "/dashboard" });
        return;
      }
      setStep((s) => s + 1);
    } catch (err) {
      const detail = err instanceof Error ? err.message : undefined;
      toast.error("Couldn't save that step", detail ? { description: detail } : undefined);
    }
  }

  const saving =
    updateProfile.isPending ||
    addGoal.isPending ||
    addFamilyMember.isPending ||
    addMedication.isPending ||
    updateLifestyle.isPending;

  if (checkingSession) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 gradient-glow pointer-events-none opacity-70" />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-soft">
              <Heart className="h-4.5 w-4.5 text-white" fill="white" />
            </div>
            <span className="font-semibold">Raag</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </div>
            <button
              type="button"
              onClick={() => nav({ to: "/dashboard" })}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Finish later
            </button>
          </div>
        </div>

        <div className="h-1 rounded-full bg-muted overflow-hidden mb-8">
          <div
            className="h-full gradient-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="rounded-3xl glass p-8 md:p-10">
          <div className="text-xs font-medium text-primary uppercase tracking-widest mb-2">
            {STEPS[step]}
          </div>

          {step === 0 && (
            <div className="space-y-6">
              <h2 className="font-display text-3xl">A little about you.</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Date of birth <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    required
                    value={about.dateOfBirth}
                    onChange={(e) => setAbout((a) => ({ ...a, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Height (cm)</Label>
                  <Input
                    type="number"
                    value={about.heightCm}
                    onChange={(e) => setAbout((a) => ({ ...a, heightCm: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Weight (kg)</Label>
                  <Input
                    type="number"
                    value={about.weightKg}
                    onChange={(e) => setAbout((a) => ({ ...a, weightKg: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Sex at birth <span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup
                    value={about.sex}
                    onValueChange={(v) => setAbout((a) => ({ ...a, sex: v }))}
                    className="flex flex-wrap gap-2 pt-1"
                  >
                    {["female", "male", "intersex", "prefer-not"].map((v) => (
                      <label
                        key={v}
                        className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm capitalize cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary/40"
                      >
                        <RadioGroupItem value={v} /> {v.replace("-", " ")}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-display text-3xl">What matters to you right now?</h2>
              <p className="text-sm text-muted-foreground">
                Pick as many as you like. Raag tailors your dashboard around them.
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                {GOAL_OPTIONS.map((g) => {
                  const selected = selectedGoals.has(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        setSelectedGoals((prev) => {
                          const next = new Set(prev);
                          if (next.has(g)) next.delete(g);
                          else next.add(g);
                          return next;
                        })
                      }
                      className={`cursor-pointer rounded-2xl border p-4 text-sm text-left transition ${selected ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="font-display text-3xl">Family history.</h2>
              <p className="text-sm text-muted-foreground">
                Optional but powerful - helps Raag surface inherited risk factors. Comma-separate
                multiple conditions.
              </p>
              {family.map((f, i) => (
                <div key={f.relation} className="grid md:grid-cols-3 gap-3 items-center">
                  <div className="text-sm font-medium">{f.relation}</div>
                  <Input
                    className="md:col-span-2"
                    placeholder="e.g. Type 2 Diabetes, Hypertension"
                    value={f.conditions}
                    onChange={(e) =>
                      setFamily((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, conditions: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-display text-3xl">Medications & supplements.</h2>
              <p className="text-sm text-muted-foreground">
                You can also snap a photo of your bottles later.
              </p>
              <div className="space-y-3">
                {meds.map((m, i) => (
                  <div key={i} className="grid md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
                    <Input
                      placeholder="Name"
                      value={m.name}
                      onChange={(e) =>
                        setMeds((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="Dose (e.g. 50 mcg)"
                      value={m.dose}
                      onChange={(e) =>
                        setMeds((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, dose: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="Schedule (e.g. daily)"
                      value={m.schedule}
                      onChange={(e) =>
                        setMeds((prev) =>
                          prev.map((x, idx) =>
                            idx === i ? { ...x, schedule: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setMeds((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Remove medication"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setMeds((prev) => [...prev, { name: "", dose: "", schedule: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add another
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="font-display text-3xl">Lifestyle snapshot.</h2>
              {(
                [
                  {
                    key: "alcohol",
                    label: "Alcohol",
                    opts: ["None", "Occasionally", "Weekly", "Daily"],
                  },
                  {
                    key: "smoking",
                    label: "Smoking",
                    opts: ["Never", "Former", "Occasional", "Daily"],
                  },
                  {
                    key: "exercise",
                    label: "Exercise",
                    opts: ["Sedentary", "Light", "Moderate", "Athlete"],
                  },
                  {
                    key: "diet",
                    label: "Diet",
                    opts: ["Omnivore", "Mediterranean", "Vegetarian", "Vegan"],
                  },
                ] as const
              ).map((it) => (
                <div key={it.key}>
                  <Label className="text-sm">{it.label}</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {it.opts.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setLifestyle((prev) => ({ ...prev, [it.key]: o }))}
                        className={`rounded-full border px-4 py-1.5 text-sm ${lifestyle[it.key] === o ? "gradient-primary text-white border-transparent" : "hover:bg-accent"}`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h2 className="font-display text-3xl">Connect your devices.</h2>
              <p className="text-sm text-muted-foreground">
                Wearable sync (Apple Health, Google Health Connect, Garmin, Fitbit, WHOOP, Oura) is
                arriving soon - you'll be able to connect them from Settings the moment it's live.
              </p>
              <PushNotificationPrompt />
            </div>
          )}

          <div className="mt-10 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
              className="rounded-full"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button
              onClick={finishStepAndAdvance}
              disabled={saving || (step === 0 && (!about.dateOfBirth || !about.sex))}
              className="rounded-full gradient-primary text-white border-0 shadow-soft"
            >
              {saving ? "Saving…" : step === STEPS.length - 1 ? "Finish & enter Raag" : "Continue"}{" "}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Each step saves the moment you hit Continue - only the step you're actively filling in is
          unsaved.
        </p>
      </div>
    </div>
  );
}

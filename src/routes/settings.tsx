import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AsyncBoundary } from "@/components/data-states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { AlertTriangle, CreditCard, Download, Key, Lock, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IS_DEMO } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { signOut, describeAuthError } from "@/lib/auth";
import { cancelSubscription } from "@/lib/billing";
import {
  getPushSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
} from "@/lib/push";
import {
  useProfile,
  useUpdateProfile,
  useConsentSettings,
  useUpdateConsentSettings,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useExportAllData,
  useDeleteAccount,
} from "@/lib/queries";
import type { UserProfile } from "@/lib/types";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  return (
    <AppShell title="Settings" subtitle="Privacy, security, and account controls.">
      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        <nav className="space-y-1 h-fit">
          {["Account", "Billing", "Privacy", "Security", "Data", "Notifications"].map((s, i) => (
            <a
              key={s}
              href={`#${s}`}
              className={`block rounded-xl px-3 py-2 text-sm ${i === 0 ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
            >
              {s}
            </a>
          ))}
        </nav>
        <div className="space-y-6">
          <AccountSection />
          <BillingSection />
          <PrivacySection />
          <SecuritySection />
          <DataSection />
          <NotificationsSection />

          <p className="text-[11px] text-muted-foreground text-center">
            Raag is informational and not a substitute for professional medical advice, diagnosis,
            or treatment.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function AccountSection() {
  const profileQ = useProfile();
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState<Pick<UserProfile, "name" | "timezone" | "units">>({
    name: "",
    timezone: "",
    units: "metric",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profileQ.data && !dirty) {
      setForm({
        name: profileQ.data.name,
        timezone: profileQ.data.timezone,
        units: profileQ.data.units,
      });
    }
  }, [profileQ.data, dirty]);

  return (
    <Section id="Account" title="Account" desc="Your basic profile.">
      <AsyncBoundary
        query={profileQ}
        skeleton={<div className="h-24 animate-pulse rounded-xl bg-muted" />}
      >
        {(profile) => (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Name">
                <Input
                  value={form.name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value }));
                    setDirty(true);
                  }}
                />
              </Field>
              <Field label="Email">
                <Input
                  value={profile.email}
                  disabled
                  title="Contact support to change your email"
                />
              </Field>
              <Field label="Timezone">
                <Input
                  value={form.timezone}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, timezone: e.target.value }));
                    setDirty(true);
                  }}
                />
              </Field>
              <Field label="Units">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={form.units}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, units: e.target.value as "metric" | "imperial" }));
                    setDirty(true);
                  }}
                >
                  <option value="metric">Metric</option>
                  <option value="imperial">Imperial</option>
                </select>
              </Field>
            </div>
            {dirty && (
              <Button
                onClick={() => updateProfile.mutate(form, { onSuccess: () => setDirty(false) })}
                disabled={updateProfile.isPending}
                className="rounded-full gradient-primary text-white border-0"
              >
                {updateProfile.isPending ? "Saving…" : "Save changes"}
              </Button>
            )}
          </>
        )}
      </AsyncBoundary>
    </Section>
  );
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  family: "Family",
  clinic: "Clinic",
};

function BillingSection() {
  const profileQ = useProfile();
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelSubscription();
      toast.success(
        "Cancellation requested — you'll keep access until the end of your current billing period.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel your subscription.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Section id="Billing" title="Billing" desc="Your plan and payment." icon={CreditCard}>
      <AsyncBoundary
        query={profileQ}
        skeleton={<div className="h-16 animate-pulse rounded-xl bg-muted" />}
      >
        {(profile) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                Current plan: {PLAN_LABELS[profile.plan] ?? profile.plan}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile.plan === "free" ? (
                  <>
                    Visit{" "}
                    <Link to="/pricing" className="underline">
                      Pricing
                    </Link>{" "}
                    to upgrade.
                  </>
                ) : (
                  "Manage or cancel your subscription below."
                )}
              </p>
            </div>
            {profile.plan !== "free" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="rounded-full" disabled={cancelling}>
                    Cancel plan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Cancel your {PLAN_LABELS[profile.plan]} plan?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll keep {PLAN_LABELS[profile.plan]} access until the end of your current
                      billing period, then move to Free. You can resubscribe anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my plan</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel}>Cancel plan</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </AsyncBoundary>
    </Section>
  );
}

function PrivacySection() {
  const consentQ = useConsentSettings();
  const updateConsent = useUpdateConsentSettings();

  return (
    <Section
      id="Privacy"
      title="Privacy & consent"
      desc="Fine-grained control over how your data is used."
      icon={Shield}
    >
      <AsyncBoundary
        query={consentQ}
        skeleton={<div className="h-24 animate-pulse rounded-xl bg-muted" />}
      >
        {(consent) => (
          <>
            <Toggle
              label="Use my de-identified data to improve Raag"
              desc="Never shared with third parties. Off by default."
              checked={consent.shareDeidentified}
              onChange={(v) => updateConsent.mutate({ shareDeidentified: v })}
            />
            <Toggle
              label="Allow AI to reference my family history"
              desc="Improves the accuracy of inherited-risk insights."
              checked={consent.aiUseFamilyHistory}
              onChange={(v) => updateConsent.mutate({ aiUseFamilyHistory: v })}
            />
            <Toggle
              label="Share weekly summary with my primary care provider"
              desc="You choose the recipient below."
              checked={consent.shareWithPcp}
              onChange={(v) => updateConsent.mutate({ shareWithPcp: v })}
            />
          </>
        )}
      </AsyncBoundary>
    </Section>
  );
}

function SecuritySection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changing, setChanging] = useState(false);

  async function changePassword() {
    if (next.length < 6) return toast.error("Use at least 6 characters.");
    if (next !== confirm) return toast.error("Passwords don't match.");
    setChanging(true);
    try {
      if (IS_DEMO) {
        toast.success("Password updated (demo mode — not really changed)");
      } else {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.updateUser({ password: next });
        if (error) throw error;
        toast.success("Password updated");
      }
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(describeAuthError(err));
    } finally {
      setChanging(false);
    }
  }

  return (
    <Section id="Security" title="Security" desc="Keep your Raag locked down." icon={Lock}>
      <div className="grid md:grid-cols-3 gap-3">
        <Input
          type="password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
        <Input
          type="password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <Button
        variant="outline"
        className="rounded-full"
        onClick={changePassword}
        disabled={changing || !next}
      >
        <Key className="mr-1.5 h-4 w-4" /> {changing ? "Updating…" : "Change password"}
      </Button>

      <Separator />

      <div className="opacity-60">
        <Toggle
          label="Two-factor authentication (TOTP)"
          desc="Coming soon."
          checked={false}
          onChange={() => {}}
          disabled
        />
        <Toggle
          label="Biometric unlock"
          desc="Coming with the mobile app."
          checked={false}
          onChange={() => {}}
          disabled
        />
      </div>
    </Section>
  );
}

function DataSection() {
  const exportData = useExportAllData();
  const deleteAccount = useDeleteAccount();
  const nav = useNavigate();

  function handleExport() {
    exportData.mutate(undefined, {
      onSuccess: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `raag-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Export downloaded");
      },
    });
  }

  async function handleDelete() {
    try {
      await deleteAccount.mutateAsync();
      await signOut();
      toast.success("Account deleted");
      nav({ to: "/" });
    } catch {
      // useDeleteAccount already toasts the error
    }
  }

  return (
    <Section
      id="Data"
      title="Your data"
      desc="Export or permanently delete everything."
      icon={Download}
    >
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/60 p-4">
          <div className="font-medium text-sm">Export</div>
          <p className="text-xs text-muted-foreground mt-1">
            Download everything Raag has stored about you as JSON.
          </p>
          <Button
            onClick={handleExport}
            disabled={exportData.isPending}
            className="mt-3 rounded-full gradient-primary text-white border-0"
          >
            <Download className="mr-1.5 h-4 w-4" />{" "}
            {exportData.isPending ? "Preparing…" : "Download export"}
          </Button>
        </div>
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="font-medium text-sm flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Delete account
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Permanently deletes every record. Cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-3 rounded-full">
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete everything
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your profile, records, labs, medications, and every other
                  piece of data Raag has for you. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Section>
  );
}

function NotificationsSection() {
  const prefsQ = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  return (
    <Section id="Notifications" title="Notifications" desc="Only the reminders that matter.">
      <AsyncBoundary
        query={prefsQ}
        skeleton={<div className="h-24 animate-pulse rounded-xl bg-muted" />}
      >
        {(prefs) => (
          <>
            <Toggle
              label="Medication reminders"
              checked={prefs.medicationReminders}
              onChange={(v) => updatePrefs.mutate({ medicationReminders: v })}
            />
            <Toggle
              label="Weekly health brief (email)"
              checked={prefs.weeklyBrief}
              onChange={(v) => updatePrefs.mutate({ weeklyBrief: v })}
            />
            <Toggle
              label="New lab results uploaded"
              checked={prefs.newLabResults}
              onChange={(v) => updatePrefs.mutate({ newLabResults: v })}
            />
            <Toggle
              label="Big changes in trends"
              desc="Only when Raag thinks it's worth a look."
              checked={prefs.trendAlerts}
              onChange={(v) => updatePrefs.mutate({ trendAlerts: v })}
            />
          </>
        )}
      </AsyncBoundary>
      <Separator />
      <PushNotificationToggle />
    </Section>
  );
}

function PushNotificationToggle() {
  const [state, setState] = useState<"loading" | "subscribed" | "unsubscribed" | "unsupported">(
    "loading",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushSubscriptionState().then(setState);
  }, []);

  async function toggle(enable: boolean) {
    setBusy(true);
    try {
      if (enable) {
        await subscribeToPush();
        setState("subscribed");
        toast.success("Push notifications enabled");
      } else {
        await unsubscribeFromPush();
        setState("unsubscribed");
        toast.success("Push notifications turned off");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update push notifications");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    try {
      await sendTestPush();
      toast.success("Test push sent — check your notifications");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send test push");
    }
  }

  if (state === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Push notifications aren't supported in this browser.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Toggle
        label="Push notifications"
        desc="Get a real browser/device notification for the alerts above, even when Raag isn't open."
        checked={state === "subscribed"}
        onChange={toggle}
        disabled={busy || state === "loading"}
      />
      {state === "subscribed" && (
        <Button variant="outline" size="sm" className="rounded-full" onClick={test}>
          Send test notification
        </Button>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  desc,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  desc: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="rounded-3xl border-border/60">
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            {Icon && <Icon className="h-4 w-4 text-primary" />} {title}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <Separator />
        <div className="space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { setNewPassword, describeAuthError } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (password.length < 6) return setError("Use at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setSubmitting(true);
    try {
      await setNewPassword(password);
      toast.success("Password updated — you're signed in.");
      nav({ to: "/dashboard" });
    } catch (err) {
      // A missing/expired recovery session lands here too — the link may
      // have already been used or timed out.
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 gradient-glow pointer-events-none opacity-70" />
      <div className="max-w-md mx-auto px-6 py-16">
        <Link to="/" className="flex items-center gap-2 mb-10 w-fit">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-soft">
            <Heart className="h-4.5 w-4.5 text-white" fill="white" />
          </div>
          <span className="font-semibold">Orvana</span>
        </Link>

        <div className="rounded-3xl glass p-8 md:p-10">
          <form onSubmit={onSubmit} className="space-y-6">
            <h2 className="font-display text-3xl">Set a new password.</h2>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm" htmlFor="password">New password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm" htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
              {error && (
                <p className="text-xs text-destructive">
                  {error} If your link expired, <Link to="/forgot-password" className="underline">request a new one</Link>.
                </p>
              )}
            </div>
            <Button type="submit" disabled={submitting} className="w-full rounded-full gradient-primary text-white border-0 shadow-soft">
              {submitting ? "Updating…" : "Update password"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

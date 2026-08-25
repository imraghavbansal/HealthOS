import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signInWithEmail, signInWithGoogle, describeAuthError } from "@/lib/auth";
import { api, IS_DEMO } from "@/lib/api";
import { GoogleButton } from "@/components/google-button";
import { useRedirectIfAuthenticated } from "@/lib/use-redirect-if-authenticated";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const { checking: checkingExistingSession } = useRedirectIfAuthenticated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function onGoogleClick() {
    setError(undefined);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      // In real mode the browser has already navigated away to Google by
      // this point (full-page redirect), so this never runs there. Demo
      // mode has nothing to redirect to, so it needs the explicit nav.
      if (IS_DEMO) {
        const profile = await api.getProfile();
        nav({ to: profile.onboardingCompleted === false ? "/onboarding" : "/dashboard" });
      }
    } catch (err) {
      setError(describeAuthError(err));
      setGoogleSubmitting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      const profile = await api.getProfile();
      toast.success(`Welcome back, ${profile.name.split(" ")[0]}`);
      nav({ to: profile.onboardingCompleted === false ? "/onboarding" : "/dashboard" });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingExistingSession) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 gradient-glow pointer-events-none opacity-70" />
      <div className="max-w-md mx-auto px-6 py-16">
        <Link to="/" className="flex items-center gap-2 mb-10 w-fit">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-soft">
            <Heart className="h-4.5 w-4.5 text-white" fill="white" />
          </div>
          <span className="font-semibold">Raag</span>
        </Link>

        <div className="rounded-3xl glass p-8 md:p-10">
          <form onSubmit={onSubmit} className="space-y-6">
            <h2 className="font-display text-3xl">Welcome back.</h2>

            <GoogleButton
              onClick={onGoogleClick}
              loading={googleSubmitting}
              label="Continue with Google"
            />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm" htmlFor="email">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm" htmlFor="password">
                    Password
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full gradient-primary text-white border-0 shadow-soft"
            >
              {submitting ? "Signing in…" : "Sign in"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              New to Raag?{" "}
              <Link to="/signup" className="text-primary font-medium">
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

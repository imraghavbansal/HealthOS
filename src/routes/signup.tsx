import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Heart, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signUpWithEmail, signInWithGoogle, describeAuthError } from "@/lib/auth";
import { GoogleButton } from "@/components/google-button";
import { api, IS_DEMO } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/use-redirect-if-authenticated";

export const Route = createFileRoute("/signup")({ component: Signup });

type FormState = { name: string; email: string; password: string; confirmPassword: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Enter a valid email address.";
  if (form.password.length < 6) errors.password = "Use at least 6 characters.";
  if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords don't match.";
  return errors;
}

function Signup() {
  const nav = useNavigate();
  const { checking: checkingExistingSession } = useRedirectIfAuthenticated();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState<string | undefined>();

  async function onGoogleClick() {
    setGoogleError(undefined);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      // Real mode: browser has already redirected to Google by now. Demo
      // mode has no OAuth provider to redirect to, so nav explicitly.
      if (IS_DEMO) {
        const profile = await api.getProfile();
        nav({ to: profile.onboardingCompleted === false ? "/onboarding" : "/dashboard" });
      }
    } catch (err) {
      setGoogleError(describeAuthError(err));
      setGoogleSubmitting(false);
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUpWithEmail(
        form.email,
        form.password,
        form.name.trim(),
      );
      if (needsEmailConfirmation) {
        setAwaitingConfirmation(true);
      } else {
        toast.success(`Welcome to Raag, ${form.name.trim().split(" ")[0]} 👋`);
        nav({ to: "/onboarding" });
      }
    } catch (err) {
      toast.error(describeAuthError(err));
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
          {awaitingConfirmation ? (
            <div className="space-y-4 text-center py-6">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="font-display text-2xl">Check your inbox.</h2>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to{" "}
                <span className="font-medium text-foreground">{form.email}</span>. Click it to
                activate your account - you'll land straight in onboarding.
              </p>
              <p className="text-xs text-muted-foreground pt-2">
                Wrong email?{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setAwaitingConfirmation(false)}
                >
                  Go back
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <h2 className="font-display text-3xl">Create your Raag.</h2>

              <GoogleButton
                onClick={onGoogleClick}
                loading={googleSubmitting}
                label="Continue with Google"
              />
              {googleError && <p className="text-xs text-destructive">{googleError}</p>}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm" htmlFor="name">
                    Full name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Alex Morgan"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm" htmlFor="email">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="alex@example.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm" htmlFor="password">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    aria-invalid={!!errors.password}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm" htmlFor="confirmPassword">
                    Confirm password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    aria-invalid={!!errors.confirmPassword}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full gradient-primary text-white border-0 shadow-soft"
              >
                {submitting ? "Creating your Raag…" : "Continue"}{" "}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you accept the informational nature of Raag - not medical advice.
        </p>
      </div>
    </div>
  );
}

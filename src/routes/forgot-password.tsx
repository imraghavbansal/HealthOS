import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Heart, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { requestPasswordReset, describeAuthError } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      toast.error(describeAuthError(err));
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
          {sent ? (
            <div className="space-y-4 text-center py-6">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="font-display text-2xl">Check your inbox.</h2>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>, a password
                reset link is on its way.
              </p>
              <Link to="/login" className="text-sm text-primary font-medium">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <h2 className="font-display text-3xl">Reset your password.</h2>
                <p className="text-sm text-muted-foreground mt-2">We'll email you a link to set a new one.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm" htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="alex@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={submitting} className="w-full rounded-full gradient-primary text-white border-0 shadow-soft">
                {submitting ? "Sending…" : "Send reset link"} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary font-medium">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

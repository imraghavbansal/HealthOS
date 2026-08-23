import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { describeAuthError } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

/**
 * Landing point for the Google OAuth redirect. The browser client already
 * auto-exchanges the ?code= in the URL for a session on load (same
 * PKCE detection reset-password.tsx relies on for recovery links) — this
 * page just waits for that, then routes on based on onboarding status,
 * same as a normal email/password login.
 */
function AuthCallback() {
  const nav = useNavigate();
  const [error, setError] = useState<string | undefined>();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        // exchangeCodeForSession is idempotent-safe here even though
        // detectSessionInUrl may already be racing it on client init —
        // whichever finishes first wins, the other resolves against the
        // now-established session.
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session)
          throw new Error("No session after Google sign-in — the link may have expired.");

        const profile = await api.getProfile();
        toast.success(`Welcome, ${profile.name.split(" ")[0]}`);
        nav({ to: profile.onboardingCompleted === false ? "/onboarding" : "/dashboard" });
      } catch (err) {
        setError(describeAuthError(err));
      }
    })();
  }, [nav]);

  return (
    <div className="min-h-screen bg-background text-foreground grid place-items-center">
      <div className="fixed inset-0 -z-10 gradient-glow pointer-events-none opacity-70" />
      <div className="text-center space-y-4">
        <div className="mx-auto grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-soft">
          <Heart className="h-4.5 w-4.5 text-white" fill="white" />
        </div>
        {error ? (
          <>
            <p className="text-sm text-destructive max-w-sm">{error}</p>
            <a href="/login" className="text-sm text-primary font-medium">
              Back to sign in
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        )}
      </div>
    </div>
  );
}

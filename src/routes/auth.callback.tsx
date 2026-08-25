import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { describeAuthError } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

/**
 * Landing point for the Google OAuth redirect. The browser client's own
 * initialization already auto-detects and exchanges the ?code= in the URL
 * for a session (GoTrueClient's default detectSessionInUrl behavior) -
 * that exchange is single-use, since it deletes the PKCE code_verifier
 * once consumed. An earlier version of this page also called
 * exchangeCodeForSession(code) manually on top of that, which raced the
 * automatic exchange: whichever ran second found the verifier already
 * gone and failed with "PKCE code verifier not found in storage". Fix:
 * never call it manually - just await getSession(), which itself awaits
 * the client's internal init promise, so by the time it resolves the
 * automatic exchange has already happened.
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
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          throw new Error(
            "No session after Google sign-in - the link may have expired. Try signing in again.",
          );
        }

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

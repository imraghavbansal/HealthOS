import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api, IS_DEMO } from "./api";
import { hasActiveSession } from "./auth";

/**
 * For entry-point pages (landing, /login, /signup) that should never be
 * shown to someone who's already signed in - session cookies persist for
 * 400 days by default (@supabase/ssr), so without this, a returning user
 * hitting the bare app URL always saw the marketing page or a login form
 * again instead of landing back in their session, even though the
 * session itself was never actually lost.
 *
 * Returns `checking` so the caller can hold off rendering the public
 * page until we know for sure there's no session - otherwise a signed-in
 * user would see a flash of the login form before being redirected away.
 */
export function useRedirectIfAuthenticated(): { checking: boolean } {
  const nav = useNavigate();
  const [checking, setChecking] = useState(!IS_DEMO);

  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    hasActiveSession().then(async (ok) => {
      if (cancelled) return;
      if (!ok) {
        setChecking(false);
        return;
      }
      try {
        const profile = await api.getProfile();
        if (cancelled) return;
        nav({ to: profile.onboardingCompleted === false ? "/onboarding" : "/dashboard" });
      } catch {
        // Session cookie present but profile fetch failed (e.g. stale/
        // revoked token) - fall through to showing the public page
        // rather than getting stuck on a blank screen.
        if (!cancelled) setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [nav]);

  return { checking };
}

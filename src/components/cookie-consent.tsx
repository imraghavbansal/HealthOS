import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "@/components/motion";

const STORAGE_KEY = "raag-cookie-consent";

type ConsentChoice = { essential: true; analytics: boolean; decidedAt: string };

/**
 * Raag doesn't set any non-essential cookies today — only the Supabase
 * auth session cookie, which is strictly necessary (no consent required
 * under GDPR/DPDP for that class of cookie). This banner exists anyway so
 * the choice is real and future-proof: if analytics/marketing cookies are
 * ever added, gate them behind hasAnalyticsConsent() rather than assuming
 * consent retroactively. Stored client-side only (localStorage), never
 * sent to the server — there's nothing server-side that needs to know.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as ConsentChoice).analytics === true;
  } catch {
    return false;
  }
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!localStorage.getItem(STORAGE_KEY));
    } catch {
      // localStorage unavailable (private mode, blocked storage) — don't
      // nag on every render if we can't remember the choice anyway.
      setVisible(false);
    }
  }, []);

  function decide(analytics: boolean) {
    const choice: ConsentChoice = {
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // ignore — banner just won't remember across reloads
    }
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl glass p-4 shadow-soft sm:inset-x-auto sm:right-4"
          role="dialog"
          aria-label="Cookie preferences"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg gradient-primary text-white">
              <Cookie className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm">
                We use only strictly necessary cookies to keep you signed in — no tracking or
                advertising cookies today. If that ever changes, we'll ask again.{" "}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-primary">
                  Read our privacy policy
                </Link>
                .
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="rounded-full gradient-primary text-white border-0"
                  onClick={() => decide(true)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => decide(false)}
                >
                  Essential only
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

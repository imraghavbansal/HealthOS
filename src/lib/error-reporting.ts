type ErrorReportOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

// Swap this for a real provider (Sentry, Bugsnag, ...) when one is wired up.
// Kept as a single choke point so callers never need to change.
export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
  options: ErrorReportOptions = {},
) {
  if (typeof window === "undefined") return;
  console.error("[raag:error]", error, { ...context, ...options });
}

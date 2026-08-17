/**
 * Auth is cross-cutting (who you are), not domain data (OrvanaApi is what
 * you can see once authenticated) — kept separate from the api/ adapters
 * on purpose. In mock mode there's no real backend, so these no-op and let
 * the existing demo flow through unchanged.
 */
import { IS_DEMO } from "./api";
import { getSupabaseBrowserClient } from "./supabase/client";

export type SignUpResult = { needsEmailConfirmation: boolean };

export async function signUpWithEmail(email: string, password: string, name: string): Promise<SignUpResult> {
  if (IS_DEMO) return { needsEmailConfirmation: false };
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined,
    },
  });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session };
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  if (IS_DEMO) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (IS_DEMO) return;
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (IS_DEMO) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
  });
  if (error) throw error;
}

export async function setNewPassword(password: string): Promise<void> {
  if (IS_DEMO) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function hasActiveSession(): Promise<boolean> {
  if (IS_DEMO) return true;
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Maps Supabase's auth error messages to plain, actionable copy. */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/already registered|already exists/i.test(message)) return "An account with that email already exists — try signing in instead.";
  if (/invalid login credentials/i.test(message)) return "That email or password isn't right.";
  if (/email.*invalid/i.test(message)) return "That doesn't look like a valid email address.";
  if (/password.*(least|short|weak)/i.test(message)) return "Password is too short — use at least 6 characters.";
  if (/rate limit/i.test(message)) return "Too many attempts — wait a moment and try again.";
  return message;
}

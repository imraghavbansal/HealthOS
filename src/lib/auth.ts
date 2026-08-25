/**
 * Auth is cross-cutting (who you are), not domain data (RaagApi is what
 * you can see once authenticated) - kept separate from the api/ adapters
 * on purpose. In mock mode there's no real backend, so these no-op and let
 * the existing demo flow through unchanged.
 */
import { IS_DEMO } from "./api";
import { getSupabaseBrowserClient } from "./supabase/client";

export type SignUpResult = { needsEmailConfirmation: boolean };

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<SignUpResult> {
  if (IS_DEMO) return { needsEmailConfirmation: false };
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined,
    },
  });
  if (error) throw error;
  // Supabase deliberately doesn't error on signUp() for an email that
  // already has a confirmed account - it's an anti-enumeration measure,
  // so a stranger can't probe which emails are registered. Instead it
  // returns a 200 with no session and an empty identities array. Without
  // checking for this, a returning user re-signing-up saw "check your
  // inbox" and waited for an email that was never going to arrive,
  // instead of being told to sign in.
  if (!data.session && data.user && data.user.identities?.length === 0) {
    throw new Error("An account with that email already exists - try signing in instead.");
  }
  return { needsEmailConfirmation: !data.session };
}

/**
 * Google skips the confirm-email step entirely - Google has already
 * verified the address, so Supabase trusts it and grants a session
 * straight off the OAuth redirect. This is the primary signup/login path;
 * email/password (above) is the fallback for people who'd rather not use
 * Google, and still needs a working SMTP provider to actually deliver its
 * confirmation email.
 */
export async function signInWithGoogle(): Promise<void> {
  if (IS_DEMO) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
    },
  });
  if (error) throw error;
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
    redirectTo:
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
  });
  if (error) throw error;
}

export async function setNewPassword(password: string): Promise<void> {
  if (IS_DEMO) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * getSession() can transiently fail right after a fresh signup/sign-in -
 * most often a "JWT issued at future" clock-skew read on the token that
 * was *just* issued a moment ago. The old version of this function only
 * ever looked at `data.session`, never `error`, so any such failure was
 * silently treated as "not signed in" and bounced the user back to
 * /login despite a perfectly valid session existing - the exact bug
 * behind "have to reload after signing up." One retry after a short
 * delay resolves it without the user ever needing to intervene.
 */
export async function hasActiveSession(): Promise<boolean> {
  if (IS_DEMO) return true;
  const supabase = getSupabaseBrowserClient();
  const first = await supabase.auth.getSession();
  if (first.data.session) return true;
  if (!first.error) return false;

  await new Promise((resolve) => setTimeout(resolve, 800));
  const retry = await supabase.auth.getSession();
  return !!retry.data.session;
}

/** Maps Supabase's auth error messages to plain, actionable copy. */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/already registered|already exists/i.test(message))
    return "An account with that email already exists - try signing in instead.";
  if (/invalid login credentials/i.test(message)) return "That email or password isn't right.";
  if (/email.*invalid/i.test(message)) return "That doesn't look like a valid email address.";
  if (/password.*(least|short|weak)/i.test(message))
    return "Password is too short - use at least 6 characters.";
  if (/rate limit/i.test(message)) return "Too many attempts - wait a moment and try again.";
  return message;
}

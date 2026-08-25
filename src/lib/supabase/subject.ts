import { getSupabaseBrowserClient } from "./client";

// Every clinical row hangs off a health_subjects.id, not a raw auth user id
// (see docs/PRODUCT-VISION.md - this is what lets a household later hold
// multiple people's histories under one login). For v1, the UI only ever
// acts on "myself" - the account holder's own kind='self' subject, whose id
// is set equal to their auth id at signup (see migration's handle_new_user).
// Multi-subject switching (viewing a dependent's or shared record) is v2;
// this helper is the single place that assumption lives, so it's a small
// change later, not a rewrite.

let cachedUserId: string | undefined;

export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in.");
  cachedUserId = data.user.id;
  return cachedUserId;
}

// Because health_subjects.id === auth uid for a user's own ('self') subject,
// this is just an alias today - kept separate so call sites already say
// what they mean, and nothing needs to change when dependents/sharing ship.
export async function getMySubjectId(): Promise<string> {
  return getCurrentUserId();
}

export function resetSupabaseSessionCache() {
  cachedUserId = undefined;
}

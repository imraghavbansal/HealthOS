// Verifies the household/dependent/access-grant feature end to end:
// add a dependent, grant an existing user access via the
// lookup-user-by-email Edge Function, confirm the grantee can actually
// see the shared subject via RLS, confirm revoke removes that access,
// and confirm a third, unrelated user sees none of it.
import { createClient } from "@supabase/supabase-js";

const URL = process.env["VITE_SUPABASE_URL"];
const ANON_KEY = process.env["VITE_SUPABASE_ANON_KEY"];
if (!URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log("  ok  ", label);
  } else {
    console.error("  FAIL", label, detail ?? "");
    failures++;
  }
}

async function signUp(label) {
  const email = `raag-verify-household-${label}-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);
  const { data, error } = await client.auth.signUp({ email, password });
  if (error || !data.session) {
    console.error(
      `Sign-up failed for ${label} (turn off email confirmation temporarily):`,
      error?.message,
    );
    process.exit(1);
  }
  return { client, email, userId: data.user.id };
}

async function main() {
  console.log("── sign up owner + grantee + a third, unrelated user ──");
  const owner = await signUp("owner");
  const grantee = await signUp("grantee");
  const stranger = await signUp("stranger");
  console.log("  ok   three test users created");

  console.log("── owner adds a dependent ──────────────────────────");
  const { data: dependent, error: depErr } = await owner.client
    .from("health_subjects")
    .insert({
      kind: "dependent",
      owner_user_id: owner.userId,
      name: "Verify Test Child",
      relation: "Daughter",
    })
    .select()
    .single();
  check("dependent created", !depErr && !!dependent, depErr?.message);

  console.log("── grantee CANNOT see the dependent before any grant ──");
  const { data: beforeGrant } = await grantee.client
    .from("health_subjects")
    .select("id")
    .eq("id", dependent.id);
  check("no access before grant (RLS)", (beforeGrant ?? []).length === 0);

  console.log("── owner looks up grantee by email via Edge Function ──");
  const { data: lookup, error: lookupErr } = await owner.client.functions.invoke(
    "lookup-user-by-email",
    {
      body: { email: grantee.email },
    },
  );
  check(
    "lookup succeeded",
    !lookupErr && lookup?.found === true,
    lookupErr?.message ?? JSON.stringify(lookup),
  );
  check("lookup resolved the right user id", lookup?.userId === grantee.userId);

  console.log("── owner grants 'summary' (view-only) access ───────");
  const { data: grant, error: grantErr } = await owner.client
    .from("access_grants")
    .insert({
      subject_id: dependent.id,
      grantee_user_id: lookup.userId,
      grantee_name: lookup.name,
      grantee_email: grantee.email,
      scope: "summary",
      granted_by: owner.userId,
    })
    .select()
    .single();
  check("grant created", !grantErr && !!grant, grantErr?.message);

  console.log("── grantee CAN now view (but not edit) the dependent ──");
  const { data: afterGrant } = await grantee.client
    .from("health_subjects")
    .select("id, name")
    .eq("id", dependent.id);
  check("grantee can view after grant (RLS)", (afterGrant ?? []).length === 1);
  const { error: editErr } = await grantee.client
    .from("health_subjects")
    .update({ name: "Should not work" })
    .eq("id", dependent.id);
  const { data: stillOriginal } = await owner.client
    .from("health_subjects")
    .select("name")
    .eq("id", dependent.id)
    .single();
  check(
    "summary scope does NOT allow editing (RLS)",
    stillOriginal?.name === "Verify Test Child",
    editErr?.message,
  );

  console.log("── stranger sees nothing at all ────────────────────");
  const { data: strangerView } = await stranger.client
    .from("health_subjects")
    .select("id")
    .eq("id", dependent.id);
  check("unrelated third user has no access", (strangerView ?? []).length === 0);

  console.log("── owner revokes access ────────────────────────────");
  await owner.client
    .from("access_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grant.id);
  const { data: afterRevoke } = await grantee.client
    .from("health_subjects")
    .select("id")
    .eq("id", dependent.id);
  check("grantee loses access after revoke (RLS)", (afterRevoke ?? []).length === 0);

  console.log(failures === 0 ? `\n✅ all checks passed` : `\n❌ ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

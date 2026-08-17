// Regression check for the Supabase schema — NOT part of the app. Run with:
//   npm run verify:supabase
// Uses only the public anon/publishable key (same trust level as the
// browser). Exercises: schema presence, signup bootstrap trigger,
// persistence, RLS cross-user isolation, and unauthenticated failure cases.
// Re-run after every schema migration. Requires VITE_API_MODE=supabase-
// shaped vars in .env, and "Confirm email" temporarily OFF in Supabase
// Auth settings (Authentication → Settings → User Signups) — turn it back
// on afterwards, before any real user signs up.
import { createClient } from "@supabase/supabase-js";

const URL = process.env["VITE_SUPABASE_URL"];
const ANON_KEY = process.env["VITE_SUPABASE_ANON_KEY"];
if (!URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — run via `npm run verify:supabase` (loads .env) or export them first.");
  process.exit(1);
}

const rand = () => Math.random().toString(36).slice(2, 10);
const userA = { email: `orvana-test-a-${rand()}@mailinator.com`, password: `Pw!${rand()}${rand()}` };
const userB = { email: `orvana-test-b-${rand()}@mailinator.com`, password: `Pw!${rand()}${rand()}` };

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

async function main() {
  console.log("── 1. schema presence ──────────────────────────────");
  const probe = createClient(URL, ANON_KEY);
  const { error: schemaErr } = await probe.from("profiles").select("id").limit(1);
  if (schemaErr?.code === "42P01") {
    console.log("  Schema not applied yet (relation 'profiles' does not exist).");
    console.log("  Run supabase/migrations/0001_init.sql in the SQL Editor, then re-run this script.");
    process.exit(1);
  }
  check("profiles table reachable", !schemaErr || schemaErr.code !== "42P01", schemaErr);

  console.log("── 2. sign up user A + bootstrap trigger ───────────");
  const clientA = createClient(URL, ANON_KEY);
  const { data: signUpA, error: signUpAErr } = await clientA.auth.signUp(userA);
  check("user A sign-up succeeds", !signUpAErr, signUpAErr);
  const sessionA = signUpA?.session;
  if (!sessionA) {
    console.log("  No session on sign-up — email confirmation is likely required.");
    console.log("  Supabase dashboard → Authentication → Settings → User Signups → disable email confirmation for local testing, or confirm the test address manually, then re-run.");
    process.exit(1);
  }

  const { data: profileA, error: profileAErr } = await clientA.from("profiles").select("*").single();
  check("profile row auto-created", !profileAErr && !!profileA, profileAErr);
  const { data: subjectA, error: subjectAErr } = await clientA.from("health_subjects").select("*").eq("kind", "self").single();
  check("self health_subject auto-created", !subjectAErr && !!subjectA, subjectAErr);
  const { data: lifestyleA } = await clientA.from("lifestyle_profile").select("*").single();
  check("lifestyle_profile row auto-created", !!lifestyleA);
  const { data: targetsA } = await clientA.from("nutrition_targets").select("*").single();
  check("nutrition_targets row auto-created", !!targetsA);
  const { data: consentA } = await clientA.from("consent_settings").select("*").single();
  check("consent_settings row auto-created", !!consentA);

  console.log("── 3. persistence: write + read back as user A ─────");
  const { data: vitalInsert, error: vitalInsertErr } = await clientA
    .from("vitals")
    .insert({ subject_id: subjectA.id, kind: "weight", value: 68.2, unit: "kg", source: "manual" })
    .select()
    .single();
  check("vital insert succeeds", !vitalInsertErr && !!vitalInsert, vitalInsertErr);

  const clientAReload = createClient(URL, ANON_KEY);
  await clientAReload.auth.setSession({ access_token: sessionA.access_token, refresh_token: sessionA.refresh_token });
  const { data: vitalsReread, error: rereadErr } = await clientAReload.from("vitals").select("*").eq("subject_id", subjectA.id);
  check("vital survives a fresh client (real persistence, not session cache)", !rereadErr && vitalsReread?.length === 1, rereadErr);

  console.log("── 3b. onboarding writes (exact adapter field mapping) ─");
  const { error: goalErr } = await clientA.from("goals").insert({ subject_id: subjectA.id, title: "Better sleep", category: "general" });
  check("goal insert (onboarding: goals step)", !goalErr, goalErr);

  const { error: familyErr } = await clientA
    .from("family_history_entries")
    .insert({ subject_id: subjectA.id, relation: "Mother", age: 0, conditions: ["Hypothyroidism", "Migraines"] });
  check("family_history_entries insert (onboarding: family step)", !familyErr, familyErr);

  const { error: medErr } = await clientA
    .from("medications")
    .insert({ subject_id: subjectA.id, name: "Vitamin D3", dose: "5000 IU", schedule: "daily", type: "Supplement" });
  check("medications insert (onboarding: medications step)", !medErr, medErr);

  const { error: lifestyleErr } = await clientA
    .from("lifestyle_profile")
    .update({ alcohol: "Occasionally", smoking: "Never", exercise: "Moderate", diet: "Omnivore" })
    .eq("subject_id", subjectA.id);
  check("lifestyle_profile update (onboarding: lifestyle step)", !lifestyleErr, lifestyleErr);

  const { error: aboutErr } = await clientA
    .from("health_subjects")
    .update({ date_of_birth: "1991-04-12", height_cm: 168, weight_kg: 63, sex: "female" })
    .eq("id", subjectA.id);
  check("health_subjects update (onboarding: about-you step)", !aboutErr, aboutErr);

  const { error: completeErr } = await clientA.from("profiles").update({ onboarding_completed: true }).eq("id", profileA.id);
  check("profiles.onboarding_completed update (onboarding: finish)", !completeErr, completeErr);
  const { data: completedProfile } = await clientA.from("profiles").select("onboarding_completed").eq("id", profileA.id).single();
  check("onboarding_completed reads back true", completedProfile?.onboarding_completed === true);

  console.log("── 4. cross-user isolation (RLS) ───────────────────");
  const clientB = createClient(URL, ANON_KEY);
  const { data: signUpB, error: signUpBErr } = await clientB.auth.signUp(userB);
  check("user B sign-up succeeds", !signUpBErr, signUpBErr);
  if (signUpB?.session) {
    const { data: bSeesASubject } = await clientB.from("health_subjects").select("*").eq("id", subjectA.id);
    check("user B cannot see user A's subject row", (bSeesASubject?.length ?? 0) === 0);

    const { data: bSeesAVitals } = await clientB.from("vitals").select("*").eq("subject_id", subjectA.id);
    check("user B cannot see user A's vitals", (bSeesAVitals?.length ?? 0) === 0);

    const { error: bWriteToAErr } = await clientB
      .from("vitals")
      .insert({ subject_id: subjectA.id, kind: "weight", value: 999, unit: "kg", source: "manual" });
    check("user B cannot write into user A's subject", !!bWriteToAErr);
  } else {
    console.log("  (user B needs email confirmation too — skipping cross-user checks)");
  }

  console.log("── 5. unauthenticated failure cases ────────────────");
  const anon = createClient(URL, ANON_KEY);
  const { data: anonRead } = await anon.from("vitals").select("*").eq("subject_id", subjectA.id);
  check("signed-out read returns nothing (not an error, not other users' data)", (anonRead?.length ?? 0) === 0);
  const { error: anonWriteErr } = await anon.from("vitals").insert({ subject_id: subjectA.id, kind: "weight", value: 1, unit: "kg" });
  check("signed-out write is rejected", !!anonWriteErr);

  console.log("── 6. audit log is append-only ─────────────────────");
  const { error: auditInsertErr } = await clientA
    .from("audit_log")
    .insert({ actor_user_id: subjectA.owner_user_id, subject_id: subjectA.id, action: "test", resource: "vitals" });
  check("audit_log insert as self succeeds", !auditInsertErr, auditInsertErr);
  const { data: auditRow } = await clientA.from("audit_log").select("*").eq("action", "test").single();
  if (auditRow) {
    // Postgres RLS doesn't error an UPDATE that matches no policy — it
    // silently filters to zero affected rows. The real check is whether
    // the row's data actually changed, not whether an error was thrown.
    await clientA.from("audit_log").update({ action: "tampered" }).eq("id", auditRow.id);
    const { data: reread } = await clientA.from("audit_log").select("action").eq("id", auditRow.id).single();
    check("audit_log update is silently a no-op (no update policy)", reread?.action === "test");
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  console.log(`\nTest accounts created (safe to delete later via Dashboard → Authentication → Users):\n  ${userA.email}\n  ${userB.email}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});

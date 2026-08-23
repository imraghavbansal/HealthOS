// Verifies the provider-agnostic wearables architecture added ahead of
// having a real Vital/Terra account: sleep_entries/activity_entries
// exist with correct RLS, and confirms getSleep/getActivity's underlying
// query actually reads real rows instead of the old hardcoded [].
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

async function main() {
  const email = `raag-verify-wearables-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  console.log("── sign up test user ───────────────────────────────");
  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error(
      "Sign-up failed or needs email confirmation (turn it off temporarily):",
      signUpErr?.message,
    );
    process.exit(1);
  }
  const { data: subject } = await client
    .from("health_subjects")
    .select("id")
    .eq("kind", "self")
    .single();
  const subjectId = subject.id;

  console.log("── insert a sleep entry + activity entry ───────────");
  const today = new Date().toISOString().slice(0, 10);
  const { error: sleepErr } = await client
    .from("sleep_entries")
    .insert({
      subject_id: subjectId,
      provider: "test",
      date: today,
      total_minutes: 420,
      deep_minutes: 90,
    });
  check("sleep entry inserted", !sleepErr, sleepErr?.message);

  const { error: activityErr } = await client
    .from("activity_entries")
    .insert({
      subject_id: subjectId,
      provider: "test",
      date: today,
      steps: 8000,
      calories_burned: 2200,
    });
  check("activity entry inserted", !activityErr, activityErr?.message);

  console.log("── read them back (same shape getSleep/getActivity use) ──");
  const { data: sleepRows } = await client
    .from("sleep_entries")
    .select("date, total_minutes, deep_minutes")
    .eq("subject_id", subjectId);
  check(
    "sleep entry readable",
    (sleepRows ?? []).some((r) => r.total_minutes === 420),
  );

  const { data: activityRows } = await client
    .from("activity_entries")
    .select("date, steps, calories_burned")
    .eq("subject_id", subjectId);
  check(
    "activity entry readable",
    (activityRows ?? []).some((r) => r.steps === 8000),
  );

  console.log("── another user CANNOT see either (RLS) ────────────");
  const otherEmail = `raag-verify-wearables-other-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const otherClient = createClient(URL, ANON_KEY);
  const { error: otherSignUpErr } = await otherClient.auth.signUp({ email: otherEmail, password });
  if (!otherSignUpErr) {
    const { data: crossSleep } = await otherClient
      .from("sleep_entries")
      .select("id")
      .eq("subject_id", subjectId);
    check("cross-user sleep read returns nothing", (crossSleep ?? []).length === 0);
    const { data: crossActivity } = await otherClient
      .from("activity_entries")
      .select("id")
      .eq("subject_id", subjectId);
    check("cross-user activity read returns nothing", (crossActivity ?? []).length === 0);
  } else {
    console.log("  (skipped — second sign-up failed:", otherSignUpErr.message, ")");
  }

  console.log("── duplicate (subject, provider, date) is rejected ──");
  const { error: dupErr } = await client
    .from("sleep_entries")
    .insert({ subject_id: subjectId, provider: "test", date: today, total_minutes: 300 });
  check("unique constraint enforced", !!dupErr);

  console.log(failures === 0 ? `\n✅ all checks passed` : `\n❌ ${failures} check(s) failed`);
  console.log(
    "\nNote: wearable-webhook's actual provider payload parsing is intentionally unimplemented",
  );
  console.log(
    "(throws) until a Vital/Terra account exists — this script only covers the schema/RLS side.",
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

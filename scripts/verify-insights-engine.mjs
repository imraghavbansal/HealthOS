// Verifies generate_insights() (0009_insights_engine.sql) actually fires
// each of its three rules against real data, not just that it compiles.
// Signs up a throwaway test user, seeds vitals/lab/dose-log data crafted
// to trip each rule, calls the RPC, and asserts the resulting insight rows.
import { createClient } from "@supabase/supabase-js";

const URL = process.env["VITE_SUPABASE_URL"];
const ANON_KEY = process.env["VITE_SUPABASE_ANON_KEY"];
if (!URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log("  ok  ", label);
  } else {
    console.error("  FAIL", label);
    failures++;
  }
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

async function main() {
  const email = `raag-verify-insights-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  console.log("── sign up test user ───────────────────────────────");
  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error("Sign-up failed or needs email confirmation (turn it off temporarily):", signUpErr?.message);
    process.exit(1);
  }
  const { data: subject } = await client.from("health_subjects").select("id").eq("kind", "self").single();
  const subjectId = subject.id;
  console.log("  ok   signed up:", email, "subject:", subjectId);

  console.log("── seed data crafted to trip each rule ─────────────");

  // Vital trend: baseline ~70bpm (60-90 days ago), recent ~90bpm (last 30
  // days) — a clear +28% jump, well past the 10% threshold.
  const vitalRows = [
    ...[85, 88, 84].map((value, i) => ({ subject_id: subjectId, kind: "restingHr", value, unit: "bpm", recorded_at: daysAgo(75 - i) })),
    ...[68, 72, 70].map((value, i) => ({ subject_id: subjectId, kind: "restingHr", value, unit: "bpm", recorded_at: daysAgo(70 - i) })),
    ...[91, 95, 93].map((value, i) => ({ subject_id: subjectId, kind: "restingHr", value, unit: "bpm", recorded_at: daysAgo(10 - i) })),
  ];
  const { error: vitalErr } = await client.from("vitals").insert(vitalRows);
  check("seeded vitals for trend detection", !vitalErr);

  // Out-of-range lab marker.
  const { error: labErr } = await client.from("lab_markers").insert({
    subject_id: subjectId,
    name: "LDL Cholesterol",
    value: 220,
    unit: "mg/dL",
    range_low: 0,
    range_high: 130,
    collected_at: daysAgo(5),
  });
  check("seeded out-of-range lab marker", !labErr);

  // Medication with poor adherence: 6 logs, only 1 taken (17%).
  const { data: med, error: medErr } = await client
    .from("medications")
    .insert({ subject_id: subjectId, name: "Verify-Test Med", active: true })
    .select()
    .single();
  check("seeded medication", !medErr);
  if (med) {
    const doseRows = [false, true, true, true, true, true].map((skipped, i) => ({
      medication_id: med.id,
      subject_id: subjectId,
      skipped,
      taken_at: daysAgo(i + 1),
    }));
    const { error: doseErr } = await client.from("dose_logs").insert(doseRows);
    check("seeded dose logs for adherence drop", !doseErr);
  }

  console.log("── call generate_insights() ────────────────────────");
  const { error: rpcErr } = await client.rpc("generate_insights", { p_subject_id: subjectId });
  check("generate_insights() ran without error", !rpcErr);
  if (rpcErr) console.error("  ", rpcErr.message);

  const { data: insights, error: readErr } = await client.from("insights").select("title, body, source_refs").eq("subject_id", subjectId);
  check("read back insights", !readErr);

  const titles = (insights ?? []).map((i) => i.title);
  console.log("  insight titles:", titles);

  check(
    "vital-trend insight fired",
    titles.some((t) => t.includes("Resting heart rate is trending up")),
  );
  check(
    "out-of-range lab insight fired",
    titles.some((t) => t.includes("LDL Cholesterol is outside the typical range")),
  );
  check(
    "adherence-drop insight fired",
    titles.some((t) => t.includes("Adherence to Verify-Test Med has dropped")),
  );

  console.log("── re-run is idempotent (no duplicate rows) ────────");
  await client.rpc("generate_insights", { p_subject_id: subjectId });
  const { data: after } = await client.from("insights").select("id").eq("subject_id", subjectId);
  check("re-running didn't duplicate insight rows", (after ?? []).length === (insights ?? []).length);

  console.log("── cross-user isolation: another user can't trigger it for this subject ──");
  const otherEmail = `raag-verify-insights-other-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const otherClient = createClient(URL, ANON_KEY);
  const { error: otherSignUpErr } = await otherClient.auth.signUp({ email: otherEmail, password });
  if (!otherSignUpErr) {
    const { error: crossErr } = await otherClient.rpc("generate_insights", { p_subject_id: subjectId });
    check("cross-user RPC call rejected", !!crossErr);
  } else {
    console.log("  (skipped — second sign-up failed:", otherSignUpErr.message, ")");
  }

  console.log(failures === 0 ? `\n✅ all checks passed` : `\n❌ ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

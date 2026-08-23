// Verifies the new conditions CRUD (getConditions/addCondition/
// deleteCondition) — previously write-only via AI document parsing, no
// way to view or manually add a condition existed until now.
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
  const email = `raag-verify-conditions-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
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

  console.log("── add a condition ─────────────────────────────────");
  const { data: added, error: addErr } = await client
    .from("conditions")
    .insert({
      subject_id: subjectId,
      name: "Verify Test Condition",
      status: "active",
      verified_by_user: true,
    })
    .select()
    .single();
  check("condition created", !addErr && !!added, addErr?.message);
  check("verified_by_user is true for a manual entry", added?.verified_by_user === true);

  console.log("── read it back ────────────────────────────────────");
  const { data: rows, error: readErr } = await client
    .from("conditions")
    .select("id, name, status")
    .eq("subject_id", subjectId);
  check("read succeeded", !readErr, readErr?.message);
  check(
    "condition is in the list",
    (rows ?? []).some((r) => r.id === added.id),
  );

  console.log("── another user CANNOT see it (RLS) ────────────────");
  const otherEmail = `raag-verify-conditions-other-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const otherClient = createClient(URL, ANON_KEY);
  const { error: otherSignUpErr } = await otherClient.auth.signUp({ email: otherEmail, password });
  if (!otherSignUpErr) {
    const { data: crossRead } = await otherClient
      .from("conditions")
      .select("id")
      .eq("id", added.id);
    check("cross-user read returns nothing", (crossRead ?? []).length === 0);
  } else {
    console.log("  (skipped — second sign-up failed:", otherSignUpErr.message, ")");
  }

  console.log("── delete it ────────────────────────────────────────");
  const { error: delErr } = await client.from("conditions").delete().eq("id", added.id);
  check("delete succeeded", !delErr, delErr?.message);
  const { data: afterDelete } = await client.from("conditions").select("id").eq("id", added.id);
  check("condition actually gone", (afterDelete ?? []).length === 0);

  console.log(failures === 0 ? `\n✅ all checks passed` : `\n❌ ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

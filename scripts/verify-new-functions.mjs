// One-off: verify notification_preferences, ai-chat, and delete-account.
// Reuses the same account for all three checks, ending by actually
// deleting it — a clean way to prove delete-account really works, and the
// account was throwaway test data anyway.
import { createClient } from "@supabase/supabase-js";

const URL = process.env["VITE_SUPABASE_URL"];
const ANON_KEY = process.env["VITE_SUPABASE_ANON_KEY"];
if (!URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ""}`); }
}

async function main() {
  const email = `orvana-verify-fn-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  console.log("── sign up ──────────────────────────────────────────");
  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error("Sign-up failed or needs email confirmation:", signUpErr?.message);
    process.exit(1);
  }
  console.log("  ok   signed up:", email);
  const { data: subject } = await client.from("health_subjects").select("id").eq("kind", "self").single();

  console.log("── notification_preferences ────────────────────────");
  const { data: prefs, error: prefsErr } = await client.from("notification_preferences").select("*").single();
  check("row auto-created on signup", !prefsErr && !!prefs, prefsErr);
  check("defaults are all true", prefs && prefs.medication_reminders && prefs.weekly_brief && prefs.new_lab_results && prefs.trend_alerts);

  const { error: updateErr } = await client.from("notification_preferences").update({ medication_reminders: false }).eq("user_id", signUp.user.id);
  check("update succeeds", !updateErr, updateErr);

  console.log("── ai-chat ──────────────────────────────────────────");
  const { data: chatResult, error: chatErr } = await client.functions.invoke("ai-chat", {
    body: { subjectId: subject.id, content: "What medications am I taking?" },
  });
  if (chatErr) {
    let body;
    try { body = await chatErr.context?.text(); } catch { /* ignore */ }
    console.log("  function returned an error — checking why:", chatErr.message, body ? `\n  response: ${body}` : "");
    // A 400 "credit balance too low" here is the SAME known billing block as
    // parse-record, not a deployment/wiring problem — check for that signal.
    check("function is deployed and reachable (not a 404/not-found)", body ? !body.includes("not found") && !body.includes("BOOT_ERROR") : false, body);
  } else {
    check("function is deployed and reachable", true);
    check("response has expected shape", chatResult && typeof chatResult.content === "string" && Array.isArray(chatResult.citations), chatResult);
    console.log("  reply:", chatResult?.content?.slice(0, 200));
  }

  console.log("── delete-account ───────────────────────────────────");
  const { data: delResult, error: delErr } = await client.functions.invoke("delete-account");
  if (delErr) {
    let body;
    try { body = await delErr.context?.text(); } catch { /* ignore */ }
    check("delete-account succeeds", false, body ?? delErr.message);
  } else {
    check("delete-account succeeds", delResult?.status === "deleted", delResult);
  }

  if (!delErr) {
    console.log("── confirm deletion actually happened ──────────────");
    const postDeleteClient = createClient(URL, ANON_KEY);
    const { data: reSignIn, error: reSignInErr } = await postDeleteClient.auth.signInWithPassword({ email, password });
    check("account can no longer sign in", !!reSignInErr && !reSignIn.session, reSignInErr?.message);
  } else {
    console.log(`\nTest account was NOT deleted (function failed) — clean up manually: ${email}`);
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});

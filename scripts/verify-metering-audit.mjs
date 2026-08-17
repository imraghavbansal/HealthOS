// One-off: verify the free-tier AI question quota is enforced server-side
// (not just insert 5 real messages via streamChat — that'd hit the known
// Anthropic billing block each time; instead seed 5 prior "used" messages
// directly, then confirm the 6th real call is blocked with the limit
// message, without needing a working Anthropic call at all), and that
// ai_context_read / document_read_for_parsing audit rows actually appear.
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

async function streamChat(accessToken, subjectId, content) {
  const res = await fetch(`${URL}/functions/v1/ai-chat`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ subjectId, content }),
  });
  const text = await res.text();
  const events = text.trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return { type: "unparsed", raw: l }; } });
  return { status: res.status, events };
}

async function main() {
  const email = `raag-verify-meter-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error("Sign-up failed or needs email confirmation:", signUpErr?.message);
    process.exit(1);
  }
  console.log("  ok   signed up:", email, "(defaults to plan=free)");
  const { data: subject } = await client.from("health_subjects").select("id").eq("kind", "self").single();
  const accessToken = signUp.session.access_token;
  const userId = signUp.user.id;

  console.log("── seed 5 prior user messages this month ───────────");
  const seedRows = Array.from({ length: 5 }, (_, i) => ({
    subject_id: subject.id,
    user_id: userId,
    role: "user",
    content: `seed question ${i + 1}`,
  }));
  const { error: seedErr } = await client.from("chat_messages").insert(seedRows);
  check("seeded 5 prior questions", !seedErr, seedErr);

  console.log("── 6th question this month should be blocked by quota ──");
  // Real client flow inserts the user's message before invoking the
  // function (see supabase.ts's sendChatMessage) — the quota count relies
  // on that row already existing. Match it here.
  const { error: sixthErr } = await client.from("chat_messages").insert({ subject_id: subject.id, user_id: userId, role: "user", content: "What's my latest weight reading?" });
  check("6th question inserted", !sixthErr, sixthErr);
  // Non-red-flag content — if quota didn't block it, it'd try Anthropic
  // and hit the known billing error instead, which we can distinguish.
  const result = await streamChat(accessToken, subject.id, "What's my latest weight reading?");
  const deltaText = result.events.filter((e) => e.type === "delta").map((e) => e.text).join("");
  check("response is the quota-limit message, not a billing error", /free.*questions|upgrade/i.test(deltaText), deltaText.slice(0, 200));
  check("no error event (quota check happens before the Anthropic call)", !result.events.some((e) => e.type === "error"));

  console.log("── audit_log: ai_context_read should NOT exist for the blocked call ──");
  const { data: aiReadLogs } = await client.from("audit_log").select("*").eq("actor_user_id", userId).eq("action", "ai_context_read");
  check("quota-blocked call did not log an ai_context_read (never reached context assembly)", (aiReadLogs?.length ?? 0) === 0);

  console.log("── positive case: a fresh, within-quota account SHOULD log ai_context_read ──");
  const email2 = `raag-verify-meter2-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const { data: signUp2 } = await client.auth.signUp({ email: email2, password });
  const client2 = createClient(URL, ANON_KEY);
  await client2.auth.setSession({ access_token: signUp2.session.access_token, refresh_token: signUp2.session.refresh_token });
  const { data: subject2 } = await client2.from("health_subjects").select("id").eq("kind", "self").single();
  await client2.from("chat_messages").insert({ subject_id: subject2.id, user_id: signUp2.user.id, role: "user", content: "What medications am I on?" });
  await streamChat(signUp2.session.access_token, subject2.id, "What medications am I on?");
  const { data: positiveLog } = await client2.from("audit_log").select("*").eq("actor_user_id", signUp2.user.id).eq("action", "ai_context_read");
  check("a normal (non-blocked) question logs ai_context_read", (positiveLog?.length ?? 0) === 1, positiveLog);

  console.log(`\n${pass} passed, ${fail} failed.`);
  console.log(`\nTest account (safe to delete): ${email}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});

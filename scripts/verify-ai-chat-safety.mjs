// One-off: verify the red-flag escalation check runs BEFORE any Anthropic
// call (so it works even with zero API credit — this is the point: safety
// never depends on the model being reachable) and that streaming responses
// are well-formed newline-delimited JSON.
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

async function streamChat(client, accessToken, subjectId, content) {
  const res = await fetch(`${URL}/functions/v1/ai-chat`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ subjectId, content }),
  });
  const text = await res.text();
  const lines = text.trim().split("\n").filter(Boolean);
  const events = lines.map((l) => { try { return JSON.parse(l); } catch { return { type: "unparsed", raw: l }; } });
  return { status: res.status, events };
}

async function main() {
  const email = `orvana-verify-safety-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error("Sign-up failed or needs email confirmation:", signUpErr?.message);
    process.exit(1);
  }
  console.log("  ok   signed up:", email);
  const { data: subject } = await client.from("health_subjects").select("id").eq("kind", "self").single();
  const accessToken = signUp.session.access_token;

  console.log("── red-flag message (should NOT need Anthropic) ────");
  const redFlag = await streamChat(client, accessToken, subject.id, "I have crushing chest pain and can't breathe");
  check("request succeeds (200)", redFlag.status === 200, redFlag);
  const deltaText = redFlag.events.filter((e) => e.type === "delta").map((e) => e.text).join("");
  check("response contains emergency guidance", /emergency|911|112|108/i.test(deltaText), deltaText.slice(0, 200));
  check("stream ends with a done event", redFlag.events.some((e) => e.type === "done"), redFlag.events.at(-1));
  check("no error event (i.e. never touched a billing-blocked Anthropic call)", !redFlag.events.some((e) => e.type === "error"));

  console.log("── normal message (well-formed stream, hits known billing block) ──");
  const normal = await streamChat(client, accessToken, subject.id, "What medications am I taking?");
  const allParsed = normal.events.every((e) => e.type !== "unparsed");
  check("every line is valid JSON (stream format is correct)", allParsed, normal.events.filter((e) => e.type === "unparsed"));
  const hasErrorOrDone = normal.events.some((e) => e.type === "error" || e.type === "done");
  check("stream terminates with either done or a clear error (not silently truncated)", hasErrorOrDone, normal.events);
  if (normal.events.some((e) => e.type === "error")) {
    console.log("  (expected: same known Anthropic billing block as parse-record)");
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});

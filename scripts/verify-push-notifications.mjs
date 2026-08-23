// Verifies the parts of 0013_push_notifications.sql that don't require an
// actual browser push subscription: push_subscriptions CRUD + RLS, and
// that generate_insights() now writes a real notifications row (not just
// an insight) — the in-app bell had nothing writing to it before this.
// Does NOT verify actual push delivery (send-push needs VAPID secrets +
// a real browser-issued subscription endpoint, neither available here) —
// that needs a manual test via Settings → "Send test notification" once
// the Edge Function is deployed and secrets are set.
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

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

async function main() {
  const email = `raag-verify-push-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
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
  const userId = signUp.user.id;
  const { data: subject } = await client
    .from("health_subjects")
    .select("id")
    .eq("kind", "self")
    .single();
  const subjectId = subject.id;

  console.log("── push_subscriptions CRUD + RLS ───────────────────");
  const { data: sub, error: subErr } = await client
    .from("push_subscriptions")
    .insert({
      user_id: userId,
      endpoint: `https://example-push-service.test/${Math.random()}`,
      p256dh: "fake-p256dh",
      auth_key: "fake-auth",
    })
    .select()
    .single();
  check("subscription created", !subErr && !!sub, subErr?.message);

  const otherEmail = `raag-verify-push-other-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const otherClient = createClient(URL, ANON_KEY);
  const { error: otherSignUpErr } = await otherClient.auth.signUp({ email: otherEmail, password });
  if (!otherSignUpErr) {
    const { data: crossRead } = await otherClient
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId);
    check("another user can't read this subscription (RLS)", (crossRead ?? []).length === 0);
  }

  const { error: delErr } = await client.from("push_subscriptions").delete().eq("id", sub.id);
  check("subscription deleted", !delErr, delErr?.message);

  console.log("── generate_insights() now also writes a real notification ──");
  const vitalRows = [
    ...[85, 88, 84].map((value, i) => ({
      subject_id: subjectId,
      kind: "restingHr",
      value,
      unit: "bpm",
      recorded_at: daysAgo(75 - i),
    })),
    ...[68, 72, 70].map((value, i) => ({
      subject_id: subjectId,
      kind: "restingHr",
      value,
      unit: "bpm",
      recorded_at: daysAgo(70 - i),
    })),
    ...[91, 95, 93].map((value, i) => ({
      subject_id: subjectId,
      kind: "restingHr",
      value,
      unit: "bpm",
      recorded_at: daysAgo(10 - i),
    })),
  ];
  await client.from("vitals").insert(vitalRows);

  const { error: rpcErr } = await client.rpc("generate_insights", { p_subject_id: subjectId });
  check("generate_insights() ran without error", !rpcErr, rpcErr?.message);

  const { data: notifs, error: notifErr } = await client
    .from("notifications")
    .select("title, kind")
    .eq("user_id", userId);
  check("notification row exists", !notifErr && (notifs ?? []).length > 0, notifErr?.message);
  check(
    "notification title matches the insight",
    (notifs ?? []).some((n) => n.title.includes("Resting heart rate is trending up")),
  );
  check(
    "notification kind is 'insight'",
    (notifs ?? []).some((n) => n.kind === "insight"),
  );

  console.log(failures === 0 ? `\n✅ all checks passed` : `\n❌ ${failures} check(s) failed`);
  console.log(
    "\nNote: actual push delivery (VAPID crypto, real browser subscription) is NOT covered by this",
  );
  console.log(
    "script — test it manually via Settings → Push notifications once send-push is deployed.",
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

// Verifies the share-links feature end to end: create → fetch via the
// public get-shared-record Edge Function → scope filtering → revoke →
// expiry → cross-user isolation on the owner-side table. Requires the
// get-shared-record function to already be deployed (Dashboard →
// Edge Functions → paste supabase/functions/get-shared-record/index.ts).
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

async function fetchShared(client, token) {
  const { data, error } = await client.functions.invoke("get-shared-record", { body: { token } });
  if (error) {
    let detail = null;
    try {
      detail = await error.context?.json?.();
    } catch {
      // ignore
    }
    return { error: detail?.error ?? error.message, status: error.context?.status };
  }
  return { data };
}

async function main() {
  const email = `raag-verify-share-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  console.log("── sign up test user, seed a medication ────────────");
  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error("Sign-up failed or needs email confirmation (turn it off temporarily):", signUpErr?.message);
    process.exit(1);
  }
  const { data: subject } = await client.from("health_subjects").select("id").eq("kind", "self").single();
  const subjectId = subject.id;

  await client.from("conditions").insert({ subject_id: subjectId, name: "Verify-Test Condition", status: "active" });
  await client.from("medications").insert({ subject_id: subjectId, name: "Verify-Test Med", dose: "10mg", active: true });
  await client.from("lab_markers").insert({
    subject_id: subjectId,
    name: "Verify-Test Marker",
    value: 5,
    unit: "u",
    range_low: 0,
    range_high: 10,
    collected_at: new Date().toISOString(),
  });

  console.log("── create a 'labs' scope link (anon client — no session) ──");
  const { data: link, error: linkErr } = await client
    .from("share_links")
    .insert({ subject_id: subjectId, created_by: signUp.user.id, scope: "labs", expires_at: new Date(Date.now() + 3600_000).toISOString() })
    .select()
    .single();
  check("share link created with server-generated token", !linkErr && !!link?.token, linkErr?.message);

  const anonClient = createClient(URL, ANON_KEY); // simulates the viewer: no session at all

  console.log("── fetch via get-shared-record as an anonymous viewer ──");
  const view = await fetchShared(anonClient, link.token);
  check("anonymous fetch succeeded", !!view.data, view.error);
  if (view.data) {
    check("subject name present", view.data.subjectName?.length > 0);
    check("active condition included", view.data.activeConditions?.some((c) => c.name === "Verify-Test Condition"));
    check("labs included for 'labs' scope", view.data.labMarkers?.some((l) => l.name === "Verify-Test Marker"));
    check("doseLogs NOT included for 'labs' scope", view.data.doseLogs === undefined);
    check("familyHistory NOT included for 'labs' scope", view.data.familyHistory === undefined);
  }

  console.log("── access is logged and counted ────────────────────");
  const { data: afterFirstFetch } = await client.from("share_links").select("access_count, last_accessed_at").eq("id", link.id).single();
  check("access_count incremented", afterFirstFetch?.access_count === 1);
  check("last_accessed_at set", !!afterFirstFetch?.last_accessed_at);
  const { data: logRows } = await client.from("share_link_access_log").select("id").eq("share_link_id", link.id);
  check("access log row written", (logRows ?? []).length === 1);

  console.log("── bogus token is rejected ─────────────────────────");
  const bogus = await fetchShared(anonClient, "not-a-real-token");
  check("bogus token returns an error, not data", !bogus.data);

  console.log("── revoked link is rejected ────────────────────────");
  await client.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", link.id);
  const afterRevoke = await fetchShared(anonClient, link.token);
  check("revoked link fetch fails", !afterRevoke.data, afterRevoke.error);

  console.log("── expired link is rejected ────────────────────────");
  const { data: expiredLink } = await client
    .from("share_links")
    .insert({
      subject_id: subjectId,
      created_by: signUp.user.id,
      scope: "summary",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    .select()
    .single();
  const expiredView = await fetchShared(anonClient, expiredLink.token);
  check("expired link fetch fails", !expiredView.data, expiredView.error);

  console.log("── cross-user isolation on the owner-side table ────");
  const otherEmail = `raag-verify-share-other-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const otherClient = createClient(URL, ANON_KEY);
  const { error: otherSignUpErr } = await otherClient.auth.signUp({ email: otherEmail, password });
  if (!otherSignUpErr) {
    const { data: crossRead } = await otherClient.from("share_links").select("id").eq("subject_id", subjectId);
    check("another user can't read this subject's share_links via RLS", (crossRead ?? []).length === 0);
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

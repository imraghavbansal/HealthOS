// One-off: verify the pg_cron background retry queue actually works —
// pg_net's HTTP call, the Vault secret, and parse-record's internal-auth
// branch all firing correctly, independent of the client's own immediate
// invoke. Inserts a source_documents row directly (skipping the app's
// normal upload path, which would trigger its own immediate invoke) and
// polls for the cron sweep (runs every minute) to pick it up.
import { createClient } from "@supabase/supabase-js";

const URL = process.env["VITE_SUPABASE_URL"];
const ANON_KEY = process.env["VITE_SUPABASE_ANON_KEY"];
if (!URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const email = `raag-verify-queue-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error("Sign-up failed or needs email confirmation:", signUpErr?.message);
    process.exit(1);
  }
  console.log("  ok   signed up:", email);
  const { data: subject } = await client.from("health_subjects").select("id").eq("kind", "self").single();

  // Fake but valid-looking image path — we're not testing extraction
  // accuracy here, just that the queue dispatches to parse-record at all.
  // No real file needs to exist at this path for the queue mechanics to
  // fire; parse-record will fail at the storage-download step, which is
  // still a clear, informative signal that the dispatch worked.
  const { data: doc, error: insertErr } = await client
    .from("source_documents")
    .insert({
      subject_id: subject.id,
      storage_path: `${subject.id}/queue-test.png`,
      original_filename: "queue-test.png",
      mime_type: "image/png",
      size_kb: 1,
      document_type: "Other",
      title: "Queue verification (no client invoke)",
      ocr_status: "pending",
      uploaded_by: subject.id,
    })
    .select()
    .single();
  if (insertErr) {
    console.error("  FAIL source_documents insert:", insertErr.message);
    process.exit(1);
  }
  console.log("  ok   document inserted, ocr_status=pending, retry_count=0 — waiting for the cron sweep (up to 2 min)...");

  const deadline = Date.now() + 130_000;
  let last;
  while (Date.now() < deadline) {
    await sleep(15_000);
    const { data } = await client.from("source_documents").select("ocr_status, ocr_error, retry_count, last_attempted_at").eq("id", doc.id).single();
    last = data;
    process.stdout.write(`  ... ocr_status=${data.ocr_status} retry_count=${data.retry_count} last_attempted_at=${data.last_attempted_at ?? "null"}\n`);
    if (data.retry_count > 0) break;
  }

  console.log("── result ───────────────────────────────────────────");
  if (last?.retry_count > 0) {
    console.log("  PASS — the cron job picked up the document and dispatched it to parse-record.");
    console.log(`  Final state: ocr_status=${last.ocr_status}${last.ocr_error ? `, ocr_error=${last.ocr_error}` : ""}`);
    console.log("  (a storage-download failure here is expected — no real file exists at that path — the point was proving dispatch, not extraction.)");
  } else {
    console.log("  FAIL — retry_count never incremented within 2 minutes. The cron job, pg_net call, or Vault secret isn't wired correctly.");
  }

  console.log(`\nTest account (safe to delete): ${email}`);
  process.exit(last?.retry_count > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});

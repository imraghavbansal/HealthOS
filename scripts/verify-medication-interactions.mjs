// Verifies the curated drug_interaction_rules table (0011_medication_
// interactions.sql) is seeded correctly and that name-matching against a
// real user's active medications works, using the same case-insensitive
// substring approach as computeMedicationInteractions() in
// src/lib/supabase/mappers.ts (reimplemented here rather than imported,
// consistent with every other verify script being a standalone .mjs).
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

function matches(name, aliases) {
  const lower = name.toLowerCase();
  return aliases.some((a) => lower.includes(a.toLowerCase()));
}

function findInteractions(meds, rules) {
  const hits = [];
  for (const rule of rules) {
    const aMeds = meds.filter((m) => matches(m.name, rule.drug_a_aliases));
    const bMeds = meds.filter((m) => matches(m.name, rule.drug_b_aliases));
    for (const a of aMeds)
      for (const b of bMeds)
        if (a.id !== b.id) hits.push({ a: a.name, b: b.name, severity: rule.severity });
  }
  return hits;
}

async function main() {
  const email = `raag-verify-meds-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
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

  console.log("── curated rule table is seeded ────────────────────");
  const { data: rules, error: rulesErr } = await client
    .from("drug_interaction_rules")
    .select("drug_a_aliases, drug_b_aliases, severity, description, recommendation");
  check("rules readable, no error", !rulesErr, rulesErr?.message);
  check("at least 20 curated rules seeded", (rules ?? []).length >= 20, `got ${rules?.length}`);

  console.log("── another user CANNOT write to the reference table ──");
  const { error: writeErr } = await client.from("drug_interaction_rules").insert({
    drug_a: "Test",
    drug_a_aliases: ["test"],
    drug_b: "Test2",
    drug_b_aliases: ["test2"],
    severity: "moderate",
    description: "x",
    recommendation: "x",
    source: "x",
  });
  check("insert blocked by RLS (no policy = denied)", !!writeErr);

  console.log("── seed a known major-interaction pair (Warfarin + Ibuprofen) ──");
  const { data: meds, error: medErr } = await client
    .from("medications")
    .insert([
      { subject_id: subjectId, name: "Warfarin 5mg", active: true },
      { subject_id: subjectId, name: "Ibuprofen 200mg", active: true },
      { subject_id: subjectId, name: "Vitamin D3", active: true },
    ])
    .select();
  check("medications inserted", !medErr && meds?.length === 3, medErr?.message);

  const hits = findInteractions(
    meds.map((m) => ({ id: m.id, name: m.name })),
    rules,
  );
  check(
    "Warfarin/Ibuprofen pair detected",
    hits.some(
      (h) =>
        (h.a.includes("Warfarin") && h.b.includes("Ibuprofen")) ||
        (h.a.includes("Ibuprofen") && h.b.includes("Warfarin")),
    ),
    JSON.stringify(hits),
  );
  check(
    "detected pair is severity 'major'",
    hits.some((h) => h.severity === "major"),
  );
  check(
    "Vitamin D3 has no false-positive interactions",
    !hits.some((h) => h.a.includes("Vitamin") || h.b.includes("Vitamin")),
  );

  console.log(failures === 0 ? `\n✅ all checks passed` : `\n❌ ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

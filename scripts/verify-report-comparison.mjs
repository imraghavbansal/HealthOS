// Verifies the report comparison feature's query logic: two lab draws on
// different dates group correctly, and the date-range query used by
// getLabReportMarkers() (gte/lt on collected_at) picks up every marker
// from a given day without leaking markers from an adjacent day.
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
  const email = `raag-verify-reportcompare-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
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

  console.log("── seed two draws, 60 days apart, with an adjacent-day decoy ──");
  const dateA = "2026-01-15";
  const dateB = "2026-03-16";
  const decoyDate = "2026-03-17"; // must NOT show up when querying dateB
  await client.from("lab_markers").insert([
    {
      subject_id: subjectId,
      name: "LDL Cholesterol",
      value: 110,
      unit: "mg/dL",
      range_low: 0,
      range_high: 130,
      collected_at: `${dateA}T09:00:00`,
    },
    {
      subject_id: subjectId,
      name: "HDL Cholesterol",
      value: 55,
      unit: "mg/dL",
      range_low: 40,
      range_high: 100,
      collected_at: `${dateA}T09:00:00`,
    },
    {
      subject_id: subjectId,
      name: "LDL Cholesterol",
      value: 145,
      unit: "mg/dL",
      range_low: 0,
      range_high: 130,
      collected_at: `${dateB}T10:30:00`,
    },
    {
      subject_id: subjectId,
      name: "Vitamin D",
      value: 28,
      unit: "ng/mL",
      range_low: 30,
      range_high: 100,
      collected_at: `${dateB}T10:30:00`,
    },
    {
      subject_id: subjectId,
      name: "Ferritin",
      value: 80,
      unit: "ng/mL",
      range_low: 20,
      range_high: 250,
      collected_at: `${decoyDate}T08:00:00`,
    },
  ]);

  console.log("── getLabReports()-equivalent: group by date ───────────────");
  const { data: rows } = await client
    .from("lab_markers")
    .select("collected_at")
    .eq("subject_id", subjectId);
  const counts = new Map();
  for (const r of rows ?? []) {
    const d = r.collected_at.slice(0, 10);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  check("draw A has exactly 2 markers", counts.get(dateA) === 2, `got ${counts.get(dateA)}`);
  check("draw B has exactly 2 markers", counts.get(dateB) === 2, `got ${counts.get(dateB)}`);
  check("decoy day counted separately", counts.get(decoyDate) === 1);

  console.log("── getLabReportMarkers()-equivalent: date-range query ──────");
  const { data: reportB } = await client
    .from("lab_markers")
    .select("name, value")
    .eq("subject_id", subjectId)
    .gte("collected_at", `${dateB}T00:00:00`)
    .lt("collected_at", `${dateB}T23:59:59.999`);
  check(
    "report B query returns exactly 2 markers (not leaking the decoy)",
    (reportB ?? []).length === 2,
    JSON.stringify(reportB),
  );
  check(
    "report B includes LDL at the new value",
    (reportB ?? []).some((m) => m.name === "LDL Cholesterol" && m.value === 145),
  );

  console.log("── diff logic: LDL newly out-of-range, HDL not retested, Vitamin D new ──");
  const { data: reportA } = await client
    .from("lab_markers")
    .select("name, value")
    .eq("subject_id", subjectId)
    .gte("collected_at", `${dateA}T00:00:00`)
    .lt("collected_at", `${dateA}T23:59:59.999`);
  const namesA = new Set((reportA ?? []).map((m) => m.name));
  const namesB = new Set((reportB ?? []).map((m) => m.name));
  check(
    "HDL present in A, absent in B (not retested)",
    namesA.has("HDL Cholesterol") && !namesB.has("HDL Cholesterol"),
  );
  check(
    "Vitamin D absent in A, present in B (new marker)",
    !namesA.has("Vitamin D") && namesB.has("Vitamin D"),
  );
  check(
    "LDL present in both (comparable)",
    namesA.has("LDL Cholesterol") && namesB.has("LDL Cholesterol"),
  );

  console.log(failures === 0 ? `\n✅ all checks passed` : `\n❌ ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

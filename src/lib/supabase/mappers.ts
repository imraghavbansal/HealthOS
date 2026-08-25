import type { LabMarker, MarkerStatus, RiskFactor } from "../types";

/** Age in whole years from a DOB, as of today. No stored/stale age field. */
export function ageFromDob(dob: string | null): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * The browser's `File.type` is empty for some extensions/OSes. Without a
 * real content-type, Storage serves the object as octet-stream, and every
 * browser force-downloads octet-stream instead of previewing it - "View"
 * and "Download" end up looking identical. This fills the gap from the
 * filename for common medical-record formats.
 */
export function resolveContentType(file: { type: string; name: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME_TYPES[ext] ?? "application/octet-stream";
}

function statusFor(value: number, low: number | null, high: number | null): MarkerStatus {
  if (low != null && value < low * 0.7) return "critical";
  if (high != null && value > high * 1.3) return "critical";
  if (low != null && value < low) return "low";
  if (high != null && value > high) return "high";
  return "normal";
}

export type LabMarkerRow = {
  id: string;
  name: string;
  value: number;
  unit: string;
  range_low: number | null;
  range_high: number | null;
  collected_at: string;
};

/**
 * The DB stores one row per result per draw (never an embedded history
 * array - see docs/raag-architecture "Data model"). This turns that
 * append-only log into the summarized-with-trend shape the UI renders:
 * latest value per marker, delta vs. the prior draw, and a month-bucketed
 * history series for the chart.
 */
export function summarizeLabMarkers(rows: LabMarkerRow[]): LabMarker[] {
  const byName = new Map<string, LabMarkerRow[]>();
  for (const row of rows) {
    const list = byName.get(row.name) ?? [];
    list.push(row);
    byName.set(row.name, list);
  }

  const markers: LabMarker[] = [];
  for (const [name, entries] of byName) {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime(),
    );
    const latest = sorted[sorted.length - 1]!;
    const prior = sorted[sorted.length - 2];
    const range =
      latest.range_low != null && latest.range_high != null
        ? `${latest.range_low}–${latest.range_high}`
        : latest.range_high != null
          ? `<${latest.range_high}`
          : latest.range_low != null
            ? `>${latest.range_low}`
            : "-";

    markers.push({
      id: latest.id,
      name,
      value: latest.value,
      unit: latest.unit,
      range,
      status: statusFor(latest.value, latest.range_low, latest.range_high),
      delta: prior ? Number((latest.value - prior.value).toFixed(2)) : 0,
      collectedAt: latest.collected_at,
      history: sorted.map((r) => ({
        month: new Date(r.collected_at).toLocaleDateString("en-US", { month: "short" }),
        value: r.value,
      })),
    });
  }
  return markers.sort((a, b) => a.name.localeCompare(b.name));
}

export type DoseLogRow = { taken_at: string; skipped: boolean };

/**
 * % of logged doses actually taken in the trailing 30 days. A medication
 * with zero logs yet reads as 100 - there's nothing to be non-adherent
 * about, and a brand-new med shouldn't look like a missed dose.
 */
export function computeAdherence(logs: DoseLogRow[]): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = logs.filter((l) => new Date(l.taken_at).getTime() >= cutoff);
  if (recent.length === 0) return 100;
  const taken = recent.filter((l) => !l.skipped).length;
  return Math.round((taken / recent.length) * 100);
}

/* ---------- rule-based risk engine (V2) ---------- */

function riskLevel(pct: number): RiskFactor["level"] {
  if (pct >= 75) return "High";
  if (pct >= 50) return "Elevated";
  if (pct >= 25) return "Moderate";
  return "Low";
}

function bmiOf(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function includesAny(haystack: string[], needles: string[]): boolean {
  return haystack.some((h) => needles.some((n) => h.includes(n)));
}

export type RiskEngineInput = {
  age: number;
  heightCm: number | null;
  weightKg: number | null;
  alcohol?: string;
  smoking?: string;
  exercise?: string;
  activeConditions: string[]; // lowercased condition names
  familyConditions: string[]; // lowercased conditions from family history
  latestSystolicBp: number | null;
  latestDiastolicBp: number | null;
  latestGlucose: number | null;
  latestSpo2: number | null;
};

/**
 * Additive point scoring per category, clamped to 0-100 and bucketed into
 * Low/Moderate/Elevated/High. Deliberately narrow to categories we have
 * real structured signal for (lifestyle, vitals, labs, conditions, family
 * history) - no cancer-type risk models, those need real clinical scoring
 * (e.g. Gail score) this data can't responsibly approximate. Framed as
 * informational throughout, matching the AI assistant's cite-don't-diagnose
 * rule (docs/PRODUCT-VISION.md) - this is a rules engine, not a diagnosis.
 */
export function computeRiskFactors(input: RiskEngineInput): RiskFactor[] {
  const bmi = bmiOf(input.heightCm, input.weightKg);
  const results: RiskFactor[] = [];

  // Cardiovascular
  {
    let pct = 10;
    const factors: string[] = [];
    if (input.age >= 60) {
      pct += 25;
      factors.push("age 60+");
    } else if (input.age >= 45) {
      pct += 15;
      factors.push("age 45+");
    }
    if (input.smoking === "Daily") {
      pct += 25;
      factors.push("daily smoking");
    } else if (input.smoking === "Occasional") {
      pct += 15;
      factors.push("smoking");
    } else if (input.smoking === "Former") {
      pct += 5;
    }
    if (input.exercise === "Sedentary") {
      pct += 15;
      factors.push("low activity level");
    } else if (input.exercise === "Light") {
      pct += 5;
    } else if (input.exercise === "Athlete") {
      pct -= 5;
    }
    if (bmi !== null && bmi >= 30) {
      pct += 20;
      factors.push("BMI in the obese range");
    } else if (bmi !== null && bmi >= 25) {
      pct += 10;
      factors.push("BMI in the overweight range");
    }
    if (input.latestSystolicBp !== null && input.latestDiastolicBp !== null) {
      if (input.latestSystolicBp >= 140 || input.latestDiastolicBp >= 90) {
        pct += 20;
        factors.push("an elevated blood pressure reading");
      } else if (input.latestSystolicBp >= 130 || input.latestDiastolicBp >= 80) {
        pct += 10;
        factors.push("a borderline blood pressure reading");
      }
    }
    if (
      includesAny(input.familyConditions, [
        "heart",
        "cardiac",
        "hypertension",
        "stroke",
        "cholesterol",
      ])
    ) {
      pct += 15;
      factors.push("family cardiovascular history");
    }
    if (includesAny(input.activeConditions, ["hypertension", "heart", "cardiac", "cholesterol"])) {
      pct += 20;
      factors.push("an existing related condition on file");
    }
    pct = Math.max(0, Math.min(100, pct));
    results.push({
      name: "Cardiovascular disease",
      level: riskLevel(pct),
      pct,
      note:
        factors.length > 0
          ? `Based on ${factors.join(", ")}.`
          : "No elevated factors found in your data yet.",
      action:
        pct >= 50
          ? "Discuss cardiovascular screening with your doctor."
          : "Keep logging vitals - trends matter more than single readings.",
    });
  }

  // Type 2 diabetes / metabolic
  {
    let pct = 5;
    const factors: string[] = [];
    if (input.age >= 60) {
      pct += 15;
      factors.push("age 60+");
    } else if (input.age >= 45) {
      pct += 10;
      factors.push("age 45+");
    }
    if (bmi !== null && bmi >= 30) {
      pct += 25;
      factors.push("BMI in the obese range");
    } else if (bmi !== null && bmi >= 25) {
      pct += 12;
      factors.push("BMI in the overweight range");
    }
    if (input.exercise === "Sedentary") {
      pct += 15;
      factors.push("low activity level");
    } else if (input.exercise === "Light") {
      pct += 5;
    }
    if (input.latestGlucose !== null && input.latestGlucose >= 140) {
      pct += 20;
      factors.push("an elevated glucose reading");
    }
    if (includesAny(input.familyConditions, ["diabetes", "diabetic"])) {
      pct += 20;
      factors.push("family history of diabetes");
    }
    if (includesAny(input.activeConditions, ["diabetes", "insulin resistance", "prediabetes"])) {
      pct += 30;
      factors.push("an existing related condition on file");
    }
    pct = Math.max(0, Math.min(100, pct));
    results.push({
      name: "Type 2 diabetes",
      level: riskLevel(pct),
      pct,
      note:
        factors.length > 0
          ? `Based on ${factors.join(", ")}.`
          : "No elevated factors found in your data yet.",
      action:
        pct >= 50
          ? "Ask your doctor about an HbA1c or fasting glucose test."
          : "Continue routine screening as your doctor recommends.",
    });
  }

  // Respiratory
  {
    let pct = 5;
    const factors: string[] = [];
    if (input.smoking === "Daily") {
      pct += 30;
      factors.push("daily smoking");
    } else if (input.smoking === "Occasional") {
      pct += 15;
      factors.push("smoking");
    } else if (input.smoking === "Former") {
      pct += 10;
      factors.push("smoking history");
    }
    if (includesAny(input.familyConditions, ["asthma", "copd", "lung", "emphysema"])) {
      pct += 20;
      factors.push("family respiratory history");
    }
    if (includesAny(input.activeConditions, ["asthma", "copd", "bronchitis"])) {
      pct += 25;
      factors.push("an existing related condition on file");
    }
    if (input.latestSpo2 !== null && input.latestSpo2 < 95) {
      pct += 25;
      factors.push("a low oxygen saturation reading");
    }
    pct = Math.max(0, Math.min(100, pct));
    results.push({
      name: "Respiratory disease",
      level: riskLevel(pct),
      pct,
      note:
        factors.length > 0
          ? `Based on ${factors.join(", ")}.`
          : "No elevated factors found in your data yet.",
      action:
        pct >= 50
          ? "Discuss lung function screening with your doctor."
          : "No action needed beyond routine checkups.",
    });
  }

  // Liver / alcohol-related
  {
    let pct = 5;
    const factors: string[] = [];
    if (input.alcohol === "Daily") {
      pct += 30;
      factors.push("daily alcohol use");
    } else if (input.alcohol === "Weekly") {
      pct += 10;
      factors.push("weekly alcohol use");
    }
    if (includesAny(input.familyConditions, ["liver", "cirrhosis", "hepatitis"])) {
      pct += 20;
      factors.push("family liver history");
    }
    if (includesAny(input.activeConditions, ["liver", "cirrhosis", "hepatitis"])) {
      pct += 30;
      factors.push("an existing related condition on file");
    }
    pct = Math.max(0, Math.min(100, pct));
    results.push({
      name: "Liver disease",
      level: riskLevel(pct),
      pct,
      note:
        factors.length > 0
          ? `Based on ${factors.join(", ")}.`
          : "No elevated factors found in your data yet.",
      action:
        pct >= 50
          ? "Discuss a liver panel with your doctor."
          : "No action needed beyond routine checkups.",
    });
  }

  return results;
}

/* ---------- medication interaction checker (V2) ---------- */

export type InteractionRuleRow = {
  drug_a_aliases: string[];
  drug_b_aliases: string[];
  severity: "moderate" | "major" | "contraindicated";
  description: string;
  recommendation: string;
};

const SEVERITY_PREFIX: Record<InteractionRuleRow["severity"], string> = {
  contraindicated: "⚠ Do not combine",
  major: "Major interaction",
  moderate: "Moderate interaction",
};

/**
 * Matches each active medication's free-text name (user-entered or
 * AI-extracted, so never guaranteed to equal a canonical drug name)
 * against the curated drug_interaction_rules aliases via case-insensitive
 * substring match. Returns a map of medication id -> human-readable
 * interaction strings, one per matched pair the medication is on either
 * side of. Deliberately a curated list, not a live medical database - see
 * 0011_medication_interactions.sql for why (RxNav's interaction API was
 * discontinued by NLM in Jan 2024, no free equivalent replaced it).
 */
export function computeMedicationInteractions(
  meds: { id: string; name: string }[],
  rules: InteractionRuleRow[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const add = (id: string, note: string) => result.set(id, [...(result.get(id) ?? []), note]);
  const matches = (name: string, aliases: string[]) => {
    const lower = name.toLowerCase();
    return aliases.some((a) => lower.includes(a.toLowerCase()));
  };

  for (const rule of rules) {
    const aMeds = meds.filter((m) => matches(m.name, rule.drug_a_aliases));
    const bMeds = meds.filter((m) => matches(m.name, rule.drug_b_aliases));
    for (const a of aMeds) {
      for (const b of bMeds) {
        if (a.id === b.id) continue;
        const prefix = SEVERITY_PREFIX[rule.severity];
        add(a.id, `${prefix} with ${b.name} - ${rule.description} ${rule.recommendation}`);
        add(b.id, `${prefix} with ${a.name} - ${rule.description} ${rule.recommendation}`);
      }
    }
  }
  return result;
}

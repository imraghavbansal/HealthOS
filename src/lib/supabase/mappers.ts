import type { LabMarker, MarkerStatus } from "../types";

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
 * browser force-downloads octet-stream instead of previewing it — "View"
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
 * array — see docs/atlas-architecture "Data model"). This turns that
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
    const range = latest.range_low != null && latest.range_high != null
      ? `${latest.range_low}–${latest.range_high}`
      : latest.range_high != null
        ? `<${latest.range_high}`
        : latest.range_low != null
          ? `>${latest.range_low}`
          : "—";

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
 * with zero logs yet reads as 100 — there's nothing to be non-adherent
 * about, and a brand-new med shouldn't look like a missed dose.
 */
export function computeAdherence(logs: DoseLogRow[]): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = logs.filter((l) => new Date(l.taken_at).getTime() >= cutoff);
  if (recent.length === 0) return 100;
  const taken = recent.filter((l) => !l.skipped).length;
  return Math.round((taken / recent.length) * 100);
}

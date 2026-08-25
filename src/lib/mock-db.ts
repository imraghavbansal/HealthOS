/**
 * Mock dataset for the v2 feature surfaces.
 *
 * REPLACE-ME: everything here is demo data. Swap the mock adapter in
 * src/lib/api/index.ts for the HTTP adapter to go live - no UI changes needed.
 */
import type {
  Appointment,
  AppNotification,
  CareTeamMember,
  NutritionEntry,
  NutritionTargets,
  SymptomEntry,
  TimelineEvent,
  VitalEntry,
} from "./types";

const day = (offset: number, h = 9, m = 0) => {
  const d = new Date(2026, 10, 20 + offset, h, m);
  return d.toISOString();
};

export const mockAppointments: Appointment[] = [
  {
    id: "a1",
    title: "Annual lipid review",
    provider: "Dr. Nadia Patel",
    specialty: "Primary care",
    start: day(4, 10, 30),
    durationMin: 30,
    location: "One Medical - Mission Bay",
    mode: "in-person",
    status: "upcoming",
    prepNotes: ["Fast 9h before", "Bring Nov lipid panel", "Ask about vitamin D dosing"],
  },
  {
    id: "a2",
    title: "Thyroid follow-up",
    provider: "Dr. Ellis Chen",
    specialty: "Endocrinology",
    start: day(11, 14, 0),
    durationMin: 20,
    location: "Video visit",
    mode: "video",
    status: "upcoming",
    prepNotes: ["Log morning TSH symptoms for 7 days"],
  },
  {
    id: "a3",
    title: "Dermatology skin check",
    provider: "Dr. Wren Alvarez",
    specialty: "Dermatology",
    start: day(26, 9, 15),
    durationMin: 25,
    location: "Bay Skin Institute",
    mode: "in-person",
    status: "upcoming",
  },
  {
    id: "a4",
    title: "Annual physical",
    provider: "Dr. Nadia Patel",
    specialty: "Primary care",
    start: day(-60, 11, 0),
    durationMin: 45,
    location: "One Medical - Mission Bay",
    mode: "in-person",
    status: "completed",
  },
];

export const mockVitals: VitalEntry[] = [
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `v-w-${i}`,
    kind: "weight" as const,
    value: 64.8 - i * 0.18 + (i % 3) * 0.12,
    unit: "kg",
    recordedAt: day(-i * 3),
    source: "device" as const,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `v-bp-${i}`,
    kind: "bloodPressure" as const,
    value: 118 + ((i * 5) % 9) - 4,
    secondary: 76 + ((i * 3) % 7) - 3,
    unit: "mmHg",
    recordedAt: day(-i * 3, 8),
    source: "manual" as const,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `v-hr-${i}`,
    kind: "restingHr" as const,
    value: 58 + ((i * 7) % 8) - 3,
    unit: "bpm",
    recordedAt: day(-i * 3, 7),
    source: "device" as const,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `v-spo2-${i}`,
    kind: "spo2" as const,
    value: 97 + (i % 3),
    unit: "%",
    recordedAt: day(-i * 3, 7),
    source: "device" as const,
  })),
];

export const mockSymptoms: SymptomEntry[] = [
  {
    id: "s1",
    label: "Afternoon fatigue",
    severity: 6,
    bodyArea: "Whole body",
    startedAt: day(-1, 15),
    tags: ["energy", "recurring"],
    note: "Peaks around 3pm, better after walking.",
  },
  {
    id: "s2",
    label: "Tension headache",
    severity: 4,
    bodyArea: "Head",
    startedAt: day(-4, 20),
    tags: ["screen time"],
  },
  {
    id: "s3",
    label: "Cold hands",
    severity: 3,
    bodyArea: "Hands",
    startedAt: day(-9, 8),
    tags: ["thyroid", "circulation"],
  },
  {
    id: "s4",
    label: "Bloating after dairy",
    severity: 5,
    bodyArea: "Abdomen",
    startedAt: day(-12, 21),
    tags: ["digestion", "diet"],
  },
];

export const mockNutrition: NutritionEntry[] = [
  {
    id: "n1",
    meal: "Breakfast",
    name: "Greek yogurt, berries, walnuts",
    kcal: 380,
    protein: 26,
    carbs: 32,
    fat: 16,
    loggedAt: day(0, 8),
  },
  {
    id: "n2",
    meal: "Snack",
    name: "Cold brew + almonds",
    kcal: 190,
    protein: 6,
    carbs: 8,
    fat: 15,
    loggedAt: day(0, 10, 30),
  },
  {
    id: "n3",
    meal: "Lunch",
    name: "Salmon grain bowl",
    kcal: 640,
    protein: 42,
    carbs: 55,
    fat: 24,
    loggedAt: day(0, 13),
  },
  {
    id: "n4",
    meal: "Snack",
    name: "Protein shake",
    kcal: 180,
    protein: 25,
    carbs: 9,
    fat: 3,
    loggedAt: day(0, 16, 30),
  },
];

export const nutritionTargets: NutritionTargets = {
  kcal: 2100,
  protein: 120,
  carbs: 210,
  fat: 70,
  waterMl: 2600,
};

export const mockTimeline: TimelineEvent[] = [
  {
    id: "t1",
    date: "Nov 12, 2026",
    kind: "lab",
    title: "Complete blood panel uploaded",
    detail: "Quest Diagnostics · 24 markers parsed, 2 flagged",
    severity: "warning",
  },
  {
    id: "t2",
    date: "Nov 09, 2026",
    kind: "goal",
    title: "24-day step streak",
    detail: "10,000 steps daily goal - longest streak yet",
    severity: "success",
  },
  {
    id: "t3",
    date: "Nov 04, 2026",
    kind: "vital",
    title: "Resting HR hit a 12-month low",
    detail: "54 bpm avg over 7 days",
    severity: "success",
  },
  {
    id: "t4",
    date: "Oct 28, 2026",
    kind: "med",
    title: "Levothyroxine dose confirmed",
    detail: "50 mcg daily · Dr. Chen",
  },
  {
    id: "t5",
    date: "Oct 04, 2026",
    kind: "visit",
    title: "Chest X-ray - clear",
    detail: "Mercy Radiology · no acute findings",
  },
  {
    id: "t6",
    date: "Sep 21, 2026",
    kind: "visit",
    title: "Annual physical",
    detail: "One Medical · BP 118/76, all systems normal",
  },
  {
    id: "t7",
    date: "Sep 12, 2026",
    kind: "device",
    title: "Apple Watch Series 10 connected",
    detail: "Backfilled 18 months of history",
  },
  {
    id: "t8",
    date: "Aug 15, 2026",
    kind: "lab",
    title: "Lipid panel",
    detail: "LabCorp · LDL 118 mg/dL (above target)",
    severity: "warning",
  },
];

export const mockNotifications: AppNotification[] = [
  {
    id: "no1",
    title: "Vitamin D3 due at 8:00 AM",
    body: "You've hit 94% adherence this month - keep it going.",
    createdAt: day(0, 7, 45),
    read: false,
    kind: "reminder",
  },
  {
    id: "no2",
    title: "New lab results parsed",
    body: "Complete blood panel from Quest - 2 markers need a look.",
    createdAt: day(-1, 16, 20),
    read: false,
    kind: "result",
  },
  {
    id: "no3",
    title: "Weekly brief ready",
    body: "Sleep improved 8%, LDL unchanged, 1 new risk note.",
    createdAt: day(-2, 9, 0),
    read: true,
    kind: "insight",
  },
  {
    id: "no4",
    title: "Garmin needs re-auth",
    body: "Reconnect to resume cycling + sleep sync.",
    createdAt: day(-4, 11, 0),
    read: true,
    kind: "system",
  },
];

export const mockCareTeam: CareTeamMember[] = [
  {
    id: "ct1",
    name: "Dr. Nadia Patel",
    role: "Primary care physician",
    org: "One Medical",
    phone: "+1 (415) 555-0142",
    sharing: true,
  },
  {
    id: "ct2",
    name: "Dr. Ellis Chen",
    role: "Endocrinologist",
    org: "UCSF Health",
    phone: "+1 (415) 555-0198",
    sharing: true,
  },
  {
    id: "ct3",
    name: "Jordan Reyes, RD",
    role: "Registered dietitian",
    org: "Raag Care Network",
    phone: "+1 (415) 555-0175",
    sharing: false,
  },
  {
    id: "ct4",
    name: "Sam Morgan",
    role: "Emergency contact (spouse)",
    org: "-",
    phone: "+1 (415) 555-0110",
    sharing: true,
  },
];

export const scorePillars = [
  { label: "Sleep", value: 82, weight: 0.25 },
  { label: "Activity", value: 91, weight: 0.25 },
  { label: "Labs", value: 74, weight: 0.3 },
  { label: "Adherence", value: 93, weight: 0.2 },
];

/**
 * Mock adapter — implements OrvanaApi entirely in memory with realistic latency
 * so every loading/empty/error state in the UI is exercised for real.
 *
 * REPLACE-ME: delete this file once http.ts is wired to your backend.
 */
import {
  activityData,
  familyHistory,
  goals as seedGoals,
  insights as seedInsights,
  labMarkers,
  labTrend,
  ldlTrend,
  medications as seedMeds,
  records as seedRecords,
  risks,
  seedChat,
  sleepData,
  user as seedUser,
  wearables as seedWearables,
} from "../sample-data";
import {
  mockAppointments,
  mockCareTeam,
  mockNotifications,
  mockNutrition,
  mockSymptoms,
  mockTimeline,
  mockVitals,
  nutritionTargets,
  scorePillars,
} from "../mock-db";
import type { OrvanaApi } from "./contract";
import type {
  Appointment,
  AppNotification,
  CareTeamMember,
  ChatMessage,
  ConsentSettings,
  FamilyMember,
  Goal,
  LifestyleProfile,
  MedicalRecord,
  Medication,
  NotificationPreferences,
  NutritionEntry,
  SymptomEntry,
  UserProfile,
  VitalEntry,
  WearableConnection,
} from "../types";

const wait = <T>(value: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

/* mutable in-memory state */
const state = {
  profile: {
    id: "u1",
    name: seedUser.name,
    initials: seedUser.initials,
    email: "alex@example.com",
    age: seedUser.age,
    sex: seedUser.sex,
    heightCm: 168,
    weightKg: 63.4,
    bloodType: "O+",
    timezone: "America/Los_Angeles",
    units: "metric",
    plan: "pro",
  } as UserProfile,
  records: [...seedRecords] as MedicalRecord[],
  wearables: [...seedWearables] as WearableConnection[],
  meds: [...seedMeds] as Medication[],
  goals: [...seedGoals] as Goal[],
  appointments: [...mockAppointments] as Appointment[],
  vitals: [...mockVitals] as VitalEntry[],
  symptoms: [...mockSymptoms] as SymptomEntry[],
  nutrition: [...mockNutrition] as NutritionEntry[],
  waterMl: 1450,
  notifications: [...mockNotifications] as AppNotification[],
  careTeam: [...mockCareTeam] as CareTeamMember[],
  chat: [...seedChat] as ChatMessage[],
  familyHistory: [...familyHistory] as FamilyMember[],
  lifestyle: {} as LifestyleProfile,
  consent: { shareDeidentified: false, aiUseFamilyHistory: true, shareWithPcp: false } as ConsentSettings,
  notificationPrefs: { medicationReminders: true, weeklyBrief: true, newLabResults: true, trendAlerts: true } as NotificationPreferences,
};

const TREND_MAP: Record<string, { month: string; value: number }[]> = {
  "Vitamin D": labTrend,
  "LDL Cholesterol": ldlTrend,
};

function scaleSeries<T extends { day: string }>(series: T[], range: "7d" | "30d" | "90d"): T[] {
  if (range === "7d") return series;
  const reps = range === "30d" ? 4 : 12;
  return Array.from({ length: reps }, (_, r) =>
    series.map((p, i) => ({ ...p, day: range === "30d" ? `W${r + 1}·${p.day}` : `${p.day}${r}`, ...jitter(p, r * 7 + i) })),
  ).flat() as T[];
}
function jitter(point: Record<string, unknown>, seed: number) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(point)) {
    if (typeof v === "number") out[k] = Number((v * (1 + Math.sin(seed) * 0.06)).toFixed(2));
  }
  return out;
}

function groundedReply(question: string): ChatMessage {
  const q = question.toLowerCase();
  const pick = (kw: string[], reply: Omit<ChatMessage, "id" | "role">) =>
    kw.some((k) => q.includes(k)) ? reply : null;

  const match =
    pick(["ldl", "cholesterol", "lipid"], {
      content:
        "Your LDL is 118 mg/dL, up ~9% from January (108). Two things in your own data line up with that: weekly cardio dropped from 4.1 to 2.8 sessions between Q2 and Q3, and saturated fat intake rose during your July–August travel. Paternal coronary artery disease adds baseline risk.\n\nInformational only — please review with your PCP.",
      citations: [
        { title: "Lipid Panel — LabCorp", date: "Aug 15, 2026" },
        { title: "Complete Blood Panel — Quest", date: "Nov 12, 2026" },
        { title: "Family History — Paternal", date: "Onboarding" },
      ],
    }) ??
    pick(["vitamin d", "vit d"], {
      content:
        "Vitamin D is 24 ng/mL — below the 30–100 reference range, and trending down across your last three panels (32 → 29 → 24). You're already on D3 5000 IU with 94% adherence, so absorption or sun exposure is the more likely lever.\n\nInformational only — discuss dosing with your clinician.",
      citations: [
        { title: "Complete Blood Panel — Quest", date: "Nov 12, 2026" },
        { title: "Medication — Vitamin D3 5000 IU", date: "Sep 28, 2026" },
      ],
    }) ??
    pick(["sleep", "tired", "fatigue", "energy"], {
      content:
        "You averaged 7.4h over the last 7 nights against an 8h goal — a ~3h 20m deficit for the week. Deep sleep held at 1.5h, which is solid. Your logged afternoon fatigue (severity 6) clusters on the days after nights under 7h.\n\nInformational only.",
      citations: [
        { title: "Sleep — Apple Health", date: "Last 7 days" },
        { title: "Symptom log — Afternoon fatigue", date: "Yesterday" },
      ],
    }) ??
    pick(["risk", "family", "heart", "diabetes"], {
      content:
        "Your highest adjusted risk right now is cardiovascular (42%, moderate) — driven by rising LDL plus paternal CAD. Type 2 diabetes sits low at 18% with a normal HbA1c of 5.2%. Hypothyroid risk is moderate given maternal history and your current levothyroxine.\n\nInformational only — not a diagnosis.",
      citations: [
        { title: "Family History — Paternal & Maternal", date: "Onboarding" },
        { title: "Complete Blood Panel — Quest", date: "Nov 12, 2026" },
      ],
    });

  return {
    id: uid("c"),
    role: "assistant",
    createdAt: new Date().toISOString(),
    ...(match ?? {
      content:
        "I pulled from your 6 most recent records and 18 months of wearable history. Nothing in your data directly answers that yet — try asking about your LDL trend, vitamin D, sleep debt, medication adherence, or inherited risk and I'll cite the exact reports.\n\nInformational only, not medical advice.",
      citations: [{ title: "Orvana record index", date: "6 documents" }],
    }),
  };
}

export const mockApi: OrvanaApi = {
  getProfile: () => wait(state.profile),
  updateProfile: (patch) => {
    state.profile = { ...state.profile, ...patch };
    return wait(state.profile, 320);
  },
  getHealthScore: () =>
    wait({
      score: seedUser.healthScore,
      delta: seedUser.scoreDelta,
      lastSync: seedUser.lastSync,
      pillars: scorePillars,
    }),
  getInsights: () => wait(seedInsights.map((i) => ({ ...i, id: String(i.id) }))),
  getSleep: (range = "7d") => wait(scaleSeries(sleepData, range)),
  getActivity: (range = "7d") => wait(scaleSeries(activityData, range)),

  getLabMarkers: () => wait(labMarkers.map((m) => ({ ...m, id: m.name, history: TREND_MAP[m.name] }))),
  getLabTrend: (marker) =>
    wait(
      TREND_MAP[marker] ??
        labTrend.map((p, i) => ({ month: p.month, value: Number((p.value * (1 + i * 0.02)).toFixed(1)) })),
    ),
  getRecords: () => wait(state.records),
  uploadRecord: (file) => {
    const rec: MedicalRecord = {
      id: uid("r"),
      type: file.type || "Other",
      title: file.name.replace(/\.[a-z0-9]+$/i, ""),
      provider: "Uploaded by you",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      tag: "Upload",
      sizeKb: Math.round(file.size / 1024),
      summary: "Queued for AI parsing — markers will appear in Lab Results shortly.",
    };
    state.records = [rec, ...state.records];
    return wait(rec, 700);
  },
  deleteRecord: (id) => {
    state.records = state.records.filter((r) => r.id !== id);
    return wait(undefined, 260);
  },

  getWearables: () => wait(state.wearables),
  toggleWearable: (name, connect) => {
    state.wearables = state.wearables.map((w) =>
      w.name === name ? { ...w, connected: connect, last: connect ? "just now" : "—" } : w,
    );
    return wait(state.wearables.find((w) => w.name === name)!, 600);
  },

  getMedications: () => wait(state.meds),
  logDose: (medicationId, taken) => {
    state.meds = state.meds.map((m) =>
      m.id === medicationId
        ? { ...m, adherence: Math.max(0, Math.min(100, m.adherence + (taken ? 1 : -2))) }
        : m,
    );
    return wait(state.meds.find((m) => m.id === medicationId)!, 240);
  },
  addMedication: (input) => {
    const med: Medication = { ...input, id: uid("m"), adherence: 100 };
    state.meds = [...state.meds, med];
    return wait(med, 380);
  },

  getGoals: () => wait(state.goals),
  addGoal: (input) => {
    const goal: Goal = { ...input, id: uid("g"), progress: 0, streak: 0 };
    state.goals = [goal, ...state.goals];
    return wait(goal, 380);
  },
  updateGoal: (id, patch) => {
    state.goals = state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g));
    return wait(state.goals.find((g) => g.id === id)!, 220);
  },
  deleteGoal: (id) => {
    state.goals = state.goals.filter((g) => g.id !== id);
    return wait(undefined, 220);
  },

  getFamilyHistory: () => wait(state.familyHistory),
  addFamilyMember: (input) => {
    const member: FamilyMember = { ...input, id: uid("fam") };
    state.familyHistory = [...state.familyHistory, member];
    return wait(member, 300);
  },
  getRisks: () => wait(risks),

  getLifestyleProfile: () => wait(state.lifestyle),
  updateLifestyleProfile: (patch) => {
    state.lifestyle = { ...state.lifestyle, ...patch };
    return wait(state.lifestyle, 280);
  },

  getAppointments: () => wait(state.appointments),
  addAppointment: (input) => {
    const appt: Appointment = { ...input, id: uid("a"), status: "upcoming" };
    state.appointments = [...state.appointments, appt];
    return wait(appt, 400);
  },
  cancelAppointment: (id) => {
    state.appointments = state.appointments.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a));
    return wait(undefined, 300);
  },

  getVitals: (kind) => wait(kind ? state.vitals.filter((v) => v.kind === kind) : state.vitals),
  addVital: (input) => {
    const vital: VitalEntry = { source: "manual", ...input, id: uid("v") };
    state.vitals = [vital, ...state.vitals];
    return wait(vital, 320);
  },

  getSymptoms: () => wait(state.symptoms),
  addSymptom: (input) => {
    const s: SymptomEntry = { ...input, id: uid("s") };
    state.symptoms = [s, ...state.symptoms];
    return wait(s, 340);
  },
  deleteSymptom: (id) => {
    state.symptoms = state.symptoms.filter((s) => s.id !== id);
    return wait(undefined, 200);
  },

  getNutrition: () => wait({ entries: state.nutrition, targets: nutritionTargets, waterMl: state.waterMl }),
  addNutrition: (input) => {
    const e: NutritionEntry = { ...input, id: uid("n") };
    state.nutrition = [...state.nutrition, e];
    return wait(e, 300);
  },
  addWater: (ml) => {
    state.waterMl = Math.max(0, state.waterMl + ml);
    return wait(state.waterMl, 150);
  },

  getTimeline: () => wait(mockTimeline),

  getNotifications: () => wait(state.notifications),
  markNotificationRead: (id) => {
    state.notifications = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    return wait(undefined, 150);
  },
  markAllNotificationsRead: () => {
    state.notifications = state.notifications.map((n) => ({ ...n, read: true }));
    return wait(undefined, 200);
  },

  getCareTeam: () => wait(state.careTeam),
  setCareSharing: (id, sharing) => {
    state.careTeam = state.careTeam.map((c) => (c.id === id ? { ...c, sharing } : c));
    return wait(state.careTeam.find((c) => c.id === id)!, 250);
  },

  requestReport: () => wait({ id: uid("rep"), status: "queued" as const }, 800),

  getConsentSettings: () => wait(state.consent),
  updateConsentSettings: (patch) => {
    state.consent = { ...state.consent, ...patch };
    return wait(state.consent, 250);
  },
  getNotificationPreferences: () => wait(state.notificationPrefs),
  updateNotificationPreferences: (patch) => {
    state.notificationPrefs = { ...state.notificationPrefs, ...patch };
    return wait(state.notificationPrefs, 250);
  },
  exportAllData: () => wait({ profile: state.profile, records: state.records, medications: state.meds, goals: state.goals }, 500),
  deleteAccount: () => wait(undefined, 500),

  getChatHistory: () => wait(state.chat),
  sendChatMessage: async (content, onDelta) => {
    state.chat = [...state.chat, { id: uid("c"), role: "user", content, createdAt: new Date().toISOString() }];
    const reply = await wait(groundedReply(content), 300);
    if (onDelta) {
      const words = reply.content.split(" ");
      for (const word of words) {
        onDelta(`${word} `);
        await wait(undefined, 25);
      }
    }
    state.chat = [...state.chat, reply];
    return reply;
  },
};

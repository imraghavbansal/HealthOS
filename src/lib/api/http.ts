/**
 * HTTP adapter — the real backend implementation.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ CLAUDE / BACKEND DEV: THIS IS THE ONLY FILE YOU NEED TO IMPLEMENT.   │
 * │ Fill in each endpoint, set VITE_API_MODE=http and VITE_API_BASE_URL  │
 * │ in .env, and the entire app becomes functional with zero UI changes. │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Auth: attach your session token in `authHeaders()` below.
 * Every method must resolve to the shapes in src/lib/types.ts.
 */
import type { RaagApi } from "./contract";
import type { ChatMessage } from "../types";

const BASE = import.meta.env["VITE_API_BASE_URL"] ?? "/api";

let accessToken: string | null = null;
/** Call this after login so every subsequent request is authenticated. */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

function authHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => undefined);
    }
    throw new ApiError(`Request failed: ${res.status} ${path}`, res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(path: string) => req<T>(path);
const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = (path: string) => req<void>(path, { method: "DELETE" });

export const httpApi: RaagApi = {
  getProfile: () => get("/me"),
  updateProfile: (p) => patch("/me", p),
  getHealthScore: () => get("/health-score"),
  getInsights: () => get("/insights"),
  dismissInsight: (id) => post(`/insights/${id}/dismiss`),
  getSleep: (range = "7d") => get(`/metrics/sleep?range=${range}`),
  getActivity: (range = "7d") => get(`/metrics/activity?range=${range}`),

  getLabMarkers: () => get("/labs/markers"),
  getLabTrend: (marker) => get(`/labs/trend?marker=${encodeURIComponent(marker)}`),
  getRecords: () => get("/records"),
  uploadRecord: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/records`, {
      method: "POST",
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
      body: form,
    });
    if (!res.ok) throw new ApiError(`Request failed: ${res.status} /records`, res.status);
    return res.json();
  },
  deleteRecord: (id) => del(`/records/${id}`),

  getWearables: () => get("/devices"),
  toggleWearable: (name, connect) =>
    post(`/devices/${encodeURIComponent(name)}/toggle`, { connect }),

  getMedications: () => get("/medications"),
  logDose: (medicationId, taken) => post(`/medications/${medicationId}/doses`, { taken }),
  addMedication: (input) => post("/medications", input),

  getGoals: () => get("/goals"),
  addGoal: (input) => post("/goals", input),
  updateGoal: (id, p) => patch(`/goals/${id}`, p),
  deleteGoal: (id) => del(`/goals/${id}`),

  getFamilyHistory: () => get("/family-history"),
  addFamilyMember: (input) => post("/family-history", input),
  getRisks: () => get("/risks"),

  getLifestyleProfile: () => get("/lifestyle"),
  updateLifestyleProfile: (p) => patch("/lifestyle", p),

  getAppointments: () => get("/appointments"),
  addAppointment: (input) => post("/appointments", input),
  cancelAppointment: (id) => post(`/appointments/${id}/cancel`),

  getVitals: (kind) => get(`/vitals${kind ? `?kind=${kind}` : ""}`),
  addVital: (input) => post("/vitals", input),

  getSymptoms: () => get("/symptoms"),
  addSymptom: (input) => post("/symptoms", input),
  deleteSymptom: (id) => del(`/symptoms/${id}`),

  getNutrition: (date) => get(`/nutrition${date ? `?date=${date}` : ""}`),
  addNutrition: (input) => post("/nutrition", input),
  addWater: (ml) => post("/nutrition/water", { ml }),

  getTimeline: () => get("/timeline"),

  getNotifications: () => get("/notifications"),
  markNotificationRead: (id) => post(`/notifications/${id}/read`),
  markAllNotificationsRead: () => post("/notifications/read-all"),

  getCareTeam: () => get("/care-team"),
  setCareSharing: (id, sharing) => patch(`/care-team/${id}`, { sharing }),

  requestReport: (r) => post("/reports", r),

  getShareLinks: () => get("/share-links"),
  createShareLink: (input) => post("/share-links", input),
  revokeShareLink: (id) => post(`/share-links/${id}/revoke`, {}),

  getConsentSettings: () => get("/account/consent"),
  updateConsentSettings: (p) => patch("/account/consent", p),
  getNotificationPreferences: () => get("/account/notification-preferences"),
  updateNotificationPreferences: (p) => patch("/account/notification-preferences", p),
  exportAllData: () => get("/account/export"),
  deleteAccount: () => post("/account/delete"),

  /**
   * REPLACE-ME (AI): for streaming, swap this for a POST to your
   * /api/chat SSE endpoint and use the AI SDK `useChat` hook in
   * src/routes/assistant.tsx. The non-streaming contract below works too.
   */
  getChatHistory: () => get("/chat/messages"),
  sendChatMessage: async (content, onDelta) => {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!res.ok || !res.body)
      throw new ApiError(`Request failed: ${res.status} /chat/stream`, res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let final: { id: string; citations: ChatMessage["citations"]; createdAt: string } | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.type === "delta") {
          accumulated += event.text;
          onDelta?.(event.text);
        }
        if (event.type === "done") final = event;
        if (event.type === "error") throw new Error(event.error);
      }
    }
    if (!final) throw new Error("Stream ended without a final message");
    return {
      id: final.id,
      role: "assistant",
      content: accumulated,
      citations: final.citations,
      createdAt: final.createdAt,
    };
  },
};

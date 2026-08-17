/**
 * Adapter switch. Set VITE_API_MODE=supabase in .env to go live (see
 * .env.example + supabase/migrations/0001_init.sql). "http" remains
 * available for a hand-rolled REST backend instead of Supabase.
 * Every component/hook imports `api` from here — nothing else.
 */
import { httpApi } from "./http";
import { mockApi } from "./mock";
import { supabaseApi } from "./supabase";
import type { AtlasApi } from "./contract";

export const API_MODE: "mock" | "http" | "supabase" =
  (import.meta.env['VITE_API_MODE'] as "mock" | "http" | "supabase" | undefined) ?? "mock";

const adapters: Record<typeof API_MODE, AtlasApi> = {
  mock: mockApi,
  http: httpApi,
  supabase: supabaseApi,
};

export const api: AtlasApi = adapters[API_MODE];

export const IS_DEMO = API_MODE === "mock";

export type { AtlasApi };
export { ApiError, setAccessToken } from "./http";

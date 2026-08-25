/**
 * The public share-link viewer has no Raag account and no Supabase
 * session - kept separate from lib/queries.ts and lib/api/* on purpose,
 * same reasoning as lib/auth.ts. supabase-js still attaches the anon key
 * as a bearer token automatically (the anon key is itself a valid signed
 * JWT for the `anon` role), so functions.invoke() works with no signed-in
 * user; the get-shared-record Edge Function does its own authorization
 * entirely from the token, using the service-role key server-side.
 */
import { IS_DEMO } from "./api";
import { getSupabaseBrowserClient } from "./supabase/client";
import type { SharedRecordView } from "./types";

export async function fetchSharedRecord(token: string): Promise<SharedRecordView> {
  if (IS_DEMO) {
    return {
      subjectName: "Alex Morgan",
      age: 34,
      sex: "Female",
      bloodType: "O+",
      activeConditions: [{ name: "Hypothyroidism", status: "chronic", diagnosed_at: null }],
      currentMedications: [
        {
          id: "m1",
          name: "Levothyroxine",
          dose: "75mcg",
          schedule: "Daily",
          type: "Prescription",
          active: true,
        },
      ],
      latestVitals: [
        {
          kind: "restingHr",
          value: 68,
          secondary: null,
          unit: "bpm",
          recorded_at: new Date().toISOString(),
        },
      ],
      scope: "summary",
      generatedAt: new Date().toISOString(),
    };
  }
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke("get-shared-record", { body: { token } });
  if (error) {
    // Edge Functions surface non-2xx as a generic FunctionsHttpError; the
    // real message (expired/revoked/not found) is in the response body.
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as SharedRecordView;
}

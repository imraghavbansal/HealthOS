// Raag — wearable-webhook
//
// SCAFFOLDING, NOT YET LIVE — there's no Vital/Terra account to receive
// real webhooks from yet (deliberate: the user doesn't want that cost
// right now). This is the provider-agnostic half of wearable sync: shared
// secret verification, subject resolution from the aggregator's external
// user id, and idempotent upsert into sleep_entries/activity_entries
// (see 0014_wearables_architecture.sql). What's genuinely missing is the
// one function marked TODO below — mapping the real webhook JSON body
// from whichever provider gets chosen into the normalized rows this
// function already knows how to store. Both Vital and Terra push
// sleep/activity as a webhook POST with a shared-secret or HMAC header;
// exactly which fields live where differs per provider and per data
// type, and guessing at that now would just be wrong code nobody's
// tested — better to leave the seam clearly marked than fake it.
//
// Once an account exists:
//   1. Set WEARABLE_WEBHOOK_SECRET here (matches whatever the provider's
//      dashboard lets you configure, or a value you mint yourself if the
//      provider supports a shared bearer token instead of HMAC).
//   2. Fill in parseProviderPayload() below using that provider's actual
//      webhook payload docs.
//   3. Point the provider's webhook URL at this function's live URL.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function →
// "wearable-webhook" → paste this file → Deploy.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

type NormalizedSleep = {
  externalUserId: string;
  provider: string;
  date: string;
  totalMinutes: number;
  deepMinutes?: number;
  remMinutes?: number;
  lightMinutes?: number;
  score?: number;
  externalId?: string;
};
type NormalizedActivity = {
  externalUserId: string;
  provider: string;
  date: string;
  steps?: number;
  caloriesBurned?: number;
  activeMinutes?: number;
  externalId?: string;
};

/**
 * TODO once a provider is chosen: parse that provider's real webhook
 * body shape into these normalized rows. Left unimplemented (throws)
 * rather than guessed, so this fails loudly instead of silently
 * accepting webhooks it can't actually interpret.
 */
function parseProviderPayload(_body: unknown): {
  sleep: NormalizedSleep[];
  activity: NormalizedActivity[];
} {
  throw new Error(
    "wearable-webhook: parseProviderPayload() is not implemented yet — fill this in against the real Vital/Terra webhook payload docs once an account exists.",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== Deno.env.get("WEARABLE_WEBHOOK_SECRET")) {
      return json({ error: "Invalid webhook secret" }, 401);
    }

    const body = await req.json();
    const { sleep, activity } = parseProviderPayload(body);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // external_user_id on wearable_connections is how we map the
    // aggregator's user back to a Raag subject — set when the user
    // actually completes the provider's connect flow (not built yet;
    // today toggleWearable() just flips a local flag, see CLAUDE.md).
    async function resolveSubjectId(
      externalUserId: string,
      provider: string,
    ): Promise<string | null> {
      const { data } = await admin
        .from("wearable_connections")
        .select("subject_id")
        .eq("external_user_id", externalUserId)
        .eq("provider", provider)
        .maybeSingle();
      return data?.subject_id ?? null;
    }

    let stored = 0;
    for (const s of sleep) {
      const subjectId = await resolveSubjectId(s.externalUserId, s.provider);
      if (!subjectId) continue;
      await admin.from("sleep_entries").upsert(
        {
          subject_id: subjectId,
          provider: s.provider,
          date: s.date,
          total_minutes: s.totalMinutes,
          deep_minutes: s.deepMinutes,
          rem_minutes: s.remMinutes,
          light_minutes: s.lightMinutes,
          score: s.score,
          external_id: s.externalId,
        },
        { onConflict: "subject_id,provider,date" },
      );
      stored++;
    }
    for (const a of activity) {
      const subjectId = await resolveSubjectId(a.externalUserId, a.provider);
      if (!subjectId) continue;
      await admin.from("activity_entries").upsert(
        {
          subject_id: subjectId,
          provider: a.provider,
          date: a.date,
          steps: a.steps,
          calories_burned: a.caloriesBurned,
          active_minutes: a.activeMinutes,
          external_id: a.externalId,
        },
        { onConflict: "subject_id,provider,date" },
      );
      stored++;
    }

    return json({ status: "ok", stored });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

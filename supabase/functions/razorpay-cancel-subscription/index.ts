// Raag - razorpay-cancel-subscription
//
// Runs as the calling user (RLS-scoped) - looks up THEIR OWN subscription
// id from `billing` (never a client-supplied id) and asks Razorpay to
// cancel it. Doesn't write plan/status itself - razorpay-webhook's
// subscription.cancelled event is the single source of truth for that,
// keeping exactly one place in the codebase that ever downgrades a plan.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function →
// "razorpay-cancel-subscription" → paste this file → Deploy.
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (shared with
// razorpay-create-subscription).

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const { data: billing } = await supabase
      .from("billing")
      .select("razorpay_subscription_id")
      .eq("user_id", userData.user.id)
      .single();
    if (!billing?.razorpay_subscription_id)
      return json({ error: "No active subscription found" }, 404);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const res = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${billing.razorpay_subscription_id}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
          "content-type": "application/json",
        },
        // cancel_at_cycle_end: finish out what's already been paid for
        // rather than cutting access off mid-period.
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      },
    );
    const body = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(body));

    return json({ status: "cancellation_requested" });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

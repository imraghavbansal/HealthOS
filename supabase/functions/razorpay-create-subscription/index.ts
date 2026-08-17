// Atlas Health — razorpay-create-subscription
//
// Runs as the calling user (RLS-scoped). Creates (or reuses) a Razorpay
// customer for them, creates a Subscription against a pre-created Razorpay
// Plan, and returns just enough (subscription_id + the public key_id) for
// the frontend to open Razorpay Checkout. The actual plan upgrade never
// happens here — only razorpay-webhook, driven by Razorpay's own signed
// event, ever writes profiles.plan/billing.status. This function only
// *starts* a payment attempt; it can't grant access to anything by itself.
//
// SETUP REQUIRED before this works:
//   1. Razorpay Dashboard → Subscriptions → Plans → create 4 plans:
//      - Pro monthly:    ₹799,   period=monthly,  interval=1
//      - Pro yearly:     ₹7999,  period=yearly,    interval=1
//      - Family monthly: ₹1999,  period=monthly,  interval=1
//      - Family yearly:  ₹19999, period=yearly,    interval=1
//      Note each plan's ID (looks like "plan_xxxxxxxxxxxx").
//   2. Edge Function secrets (this function + razorpay-webhook, razorpay-cancel-subscription):
//      RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
//      RAZORPAY_PLAN_PRO_MONTHLY, RAZORPAY_PLAN_PRO_YEARLY,
//      RAZORPAY_PLAN_FAMILY_MONTHLY, RAZORPAY_PLAN_FAMILY_YEARLY
//
// Deploy: Supabase Dashboard → Edge Functions → New Function →
// "razorpay-create-subscription" → paste this file → Deploy.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}

function razorpayAuthHeader() {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
  return "Basic " + btoa(`${keyId}:${keySecret}`);
}

async function razorpayFetch(path: string, init: RequestInit) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: razorpayAuthHeader(), "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Razorpay ${path} failed: ${JSON.stringify(body)}`);
  return body;
}

const PLAN_ENV_KEYS: Record<string, Record<string, string>> = {
  pro: { monthly: "RAZORPAY_PLAN_PRO_MONTHLY", yearly: "RAZORPAY_PLAN_PRO_YEARLY" },
  family: { monthly: "RAZORPAY_PLAN_FAMILY_MONTHLY", yearly: "RAZORPAY_PLAN_FAMILY_YEARLY" },
};
// Billing cycles Razorpay charges before a subscription naturally ends —
// set high; cancellation is handled explicitly, this isn't meant to expire.
const TOTAL_COUNT: Record<string, number> = { monthly: 120, yearly: 10 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { planKey, cycle } = await req.json();
    if (!PLAN_ENV_KEYS[planKey]?.[cycle]) return json({ error: "Unknown plan/cycle combination" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    // Identity verification runs as the calling user (their own JWT) — but
    // writes to `billing` use the service-role client below. `billing` has
    // no update policy for regular users at all (by design, so a client
    // can never grant itself a plan) — that also silently blocked this
    // function's own legitimate metadata caching (customer id, subscription
    // id) via RLS. Safe to use service-role here specifically because every
    // write below is scoped to `user.id` from the caller's own verified
    // JWT, never a client-supplied id, and never touches profiles.plan —
    // only razorpay-webhook does that.
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const user = userData.user;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existingBilling } = await supabase.from("billing").select("razorpay_customer_id").eq("user_id", user.id).single();

    let customerId = existingBilling?.razorpay_customer_id;
    if (!customerId) {
      try {
        const customer = await razorpayFetch("/customers", {
          method: "POST",
          body: JSON.stringify({ name: user.user_metadata?.name ?? user.email, email: user.email, notes: { atlas_user_id: user.id } }),
        });
        customerId = customer.id;
      } catch (err) {
        // A prior attempt (e.g. a retried request) may have already
        // created this customer in Razorpay without us having cached the
        // id yet — look it up instead of failing.
        if (String(err).includes("Customer already exists")) {
          const existing = await razorpayFetch(`/customers?email=${encodeURIComponent(user.email!)}`, { method: "GET" });
          customerId = existing.items?.[0]?.id;
          if (!customerId) throw err;
        } else {
          throw err;
        }
      }
      const { error: custUpdateErr } = await supabase.from("billing").update({ razorpay_customer_id: customerId }).eq("user_id", user.id);
      if (custUpdateErr) console.error("billing customer_id update failed:", custUpdateErr);
    }

    const planId = Deno.env.get(PLAN_ENV_KEYS[planKey][cycle])!;
    const subscription = await razorpayFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        customer_notify: 1,
        total_count: TOTAL_COUNT[cycle],
        notes: { atlas_user_id: user.id, atlas_plan_key: planKey, atlas_cycle: cycle },
      }),
    });

    const { error: subUpdateErr } = await supabase
      .from("billing")
      .update({ razorpay_subscription_id: subscription.id, status: "created", plan: planKey, billing_cycle: cycle })
      .eq("user_id", user.id);
    if (subUpdateErr) console.error("billing subscription update failed:", subUpdateErr);

    return json({
      subscriptionId: subscription.id,
      keyId: Deno.env.get("RAZORPAY_KEY_ID"),
      prefill: { name: user.user_metadata?.name ?? "", email: user.email },
    });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

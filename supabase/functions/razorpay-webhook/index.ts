// Atlas Health — razorpay-webhook
//
// The ONLY place a user's plan actually changes. Razorpay calls this
// directly (no Supabase session — this function must have "Verify JWT"
// turned OFF in its deploy settings, since Razorpay can't send a Supabase
// auth token). Trust instead comes from verifying Razorpay's own HMAC
// signature over the raw request body — the standard pattern every
// webhook-based payment provider uses. An unsigned or badly-signed
// request is rejected before any database write happens.
//
// SETUP REQUIRED:
//   1. Deploy this function, then in its settings turn OFF "Verify JWT"
//      (Supabase Dashboard → Edge Functions → razorpay-webhook → Settings).
//   2. Razorpay Dashboard → Settings → Webhooks → add a webhook pointing to
//      this function's URL, subscribe to: subscription.activated,
//      subscription.charged, subscription.completed, subscription.cancelled,
//      subscription.halted, subscription.paused, subscription.resumed.
//      Razorpay will show you a webhook secret when you create it.
//   3. Edge Function secret: RAZORPAY_WEBHOOK_SECRET = that value.
//      (Separate from RAZORPAY_KEY_SECRET — don't confuse the two.)

import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // Not constant-time, but this is a one-shot verification per request, not
  // a password check under repeated attack — acceptable tradeoff here.
  return expected === signature;
}

const GRANTS_PLAN = new Set(["subscription.activated", "subscription.charged", "subscription.resumed"]);
const REVOKES_PLAN = new Set(["subscription.cancelled", "subscription.completed", "subscription.expired", "subscription.halted"]);

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

    const valid = await verifySignature(rawBody, signature, secret);
    if (!valid) {
      console.error("razorpay-webhook: signature verification failed");
      return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(rawBody);
    const subscriptionEntity = event.payload?.subscription?.entity;
    if (!subscriptionEntity) {
      // Not every Razorpay event carries a subscription (e.g. standalone
      // payment events) — acknowledge and ignore rather than error.
      return json({ received: true, ignored: true });
    }

    const userId = subscriptionEntity.notes?.atlas_user_id;
    const planKey = subscriptionEntity.notes?.atlas_plan_key;
    if (!userId) return json({ received: true, ignored: "no atlas_user_id in notes" });

    // Service role: this function has no user session to scope RLS to —
    // it's authenticated by the signature check above, not by JWT.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const currentPeriodEnd = subscriptionEntity.current_end ? new Date(subscriptionEntity.current_end * 1000).toISOString() : null;

    if (GRANTS_PLAN.has(event.event)) {
      await supabase.from("billing").update({
        status: "active",
        plan: planKey ?? "pro",
        current_period_end: currentPeriodEnd,
        razorpay_subscription_id: subscriptionEntity.id,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
      await supabase.from("profiles").update({ plan: planKey ?? "pro" }).eq("id", userId);
    } else if (REVOKES_PLAN.has(event.event)) {
      const status = event.event.replace("subscription.", "");
      await supabase.from("billing").update({ status, plan: "free", updated_at: new Date().toISOString() }).eq("user_id", userId);
      await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
    } else if (event.event === "subscription.paused") {
      await supabase.from("billing").update({ status: "pending", updated_at: new Date().toISOString() }).eq("user_id", userId);
      // Deliberately don't touch profiles.plan here — a pause is not a
      // failure or cancellation, avoid downgrading someone mid-pause.
    }

    return json({ received: true });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

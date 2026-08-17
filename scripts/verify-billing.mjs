// One-off: verify the Razorpay billing integration end to end, without
// needing to click through Razorpay's actual payment UI.
//   1. razorpay-create-subscription: real call against Razorpay's test API,
//      confirms a real subscription gets created and billing row updates.
//   2. razorpay-webhook: the security-critical piece. Since we know the
//      webhook secret, we can construct a validly-signed fake Razorpay
//      event ourselves and confirm it correctly grants/revokes a plan —
//      and, just as important, confirm a WRONGLY-signed event is rejected
//      and changes nothing (the actual security boundary).
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const URL = process.env["VITE_SUPABASE_URL"];
const ANON_KEY = process.env["VITE_SUPABASE_ANON_KEY"];
const WEBHOOK_SECRET = "REDACTED-RAZORPAY-WEBHOOK-SECRET";
if (!URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ""}`); }
}

function sign(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function postWebhook(eventBody, secret) {
  const raw = JSON.stringify(eventBody);
  const res = await fetch(`${URL}/functions/v1/razorpay-webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": sign(raw, secret) },
    body: raw,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const email = `atlas-verify-billing-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error("Sign-up failed or needs email confirmation:", signUpErr?.message);
    process.exit(1);
  }
  console.log("  ok   signed up:", email);
  const userId = signUp.user.id;
  const accessToken = signUp.session.access_token;

  console.log("── 1. razorpay-create-subscription (real Razorpay test API call) ──");
  const createRes = await fetch(`${URL}/functions/v1/razorpay-create-subscription`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ planKey: "pro", cycle: "monthly" }),
  });
  const createBody = await createRes.json();
  check("subscription created successfully", createRes.ok && !!createBody.subscriptionId, createBody);
  check("returns a Razorpay key id for Checkout", !!createBody.keyId, createBody);

  const { data: billingRow } = await client.from("billing").select("*").eq("user_id", userId).single();
  check("billing row updated with subscription id + status=created", billingRow?.razorpay_subscription_id === createBody.subscriptionId && billingRow?.status === "created", billingRow);

  console.log("── 2a. webhook with WRONG signature should be rejected and change nothing ──");
  const fakeActivate = {
    event: "subscription.activated",
    payload: { subscription: { entity: { id: "sub_fake", current_end: Math.floor(Date.now() / 1000) + 2592000, notes: { atlas_user_id: userId, atlas_plan_key: "pro" } } } },
  };
  const badSig = await postWebhook(fakeActivate, "wrong-secret-entirely");
  check("wrong signature rejected with 401", badSig.status === 401, badSig);
  const { data: profileAfterBadSig } = await client.from("profiles").select("plan").eq("id", userId).single();
  check("plan unchanged after rejected webhook", profileAfterBadSig?.plan === "free", profileAfterBadSig);

  console.log("── 2b. correctly-signed subscription.activated grants Pro ──");
  const goodActivate = await postWebhook(fakeActivate, WEBHOOK_SECRET);
  check("correctly-signed webhook accepted", goodActivate.status === 200, goodActivate);
  const { data: profileAfterActivate } = await client.from("profiles").select("plan").eq("id", userId).single();
  check("profiles.plan updated to pro", profileAfterActivate?.plan === "pro", profileAfterActivate);
  const { data: billingAfterActivate } = await client.from("billing").select("status, plan").eq("user_id", userId).single();
  check("billing.status updated to active", billingAfterActivate?.status === "active", billingAfterActivate);

  console.log("── 2c. correctly-signed subscription.cancelled revokes back to free ──");
  const fakeCancel = {
    event: "subscription.cancelled",
    payload: { subscription: { entity: { id: "sub_fake", notes: { atlas_user_id: userId, atlas_plan_key: "pro" } } } },
  };
  const cancelResult = await postWebhook(fakeCancel, WEBHOOK_SECRET);
  check("cancel webhook accepted", cancelResult.status === 200, cancelResult);
  const { data: profileAfterCancel } = await client.from("profiles").select("plan").eq("id", userId).single();
  check("profiles.plan reverted to free", profileAfterCancel?.plan === "free", profileAfterCancel);

  console.log("── 3. razorpay-cancel-subscription (real Razorpay test API call) ──");
  // Create a fresh subscription first so there's something to cancel.
  await fetch(`${URL}/functions/v1/razorpay-create-subscription`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ planKey: "pro", cycle: "monthly" }),
  });
  const cancelRes = await fetch(`${URL}/functions/v1/razorpay-cancel-subscription`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const cancelBody = await cancelRes.json();
  check("cancel-subscription succeeds against real Razorpay API", cancelRes.ok, cancelBody);

  console.log(`\n${pass} passed, ${fail} failed.`);
  console.log(`\nTest account (safe to delete): ${email}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});

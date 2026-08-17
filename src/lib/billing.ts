import { getSupabaseBrowserClient } from "./supabase/client";
import { IS_DEMO } from "./api";

declare global {
  interface Window {
    // Razorpay's checkout.js is a third-party untyped script — narrow
    // `any` usage confined to this one file rather than adding a types dep.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

let razorpayScriptPromise: Promise<void> | undefined;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Checkout requires a browser."));
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't load the payment provider — check your connection and try again."));
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

export type PlanKey = "pro" | "family";
export type BillingCycle = "monthly" | "yearly";

export async function startCheckout(planKey: PlanKey, cycle: BillingCycle, onSuccess: () => void): Promise<void> {
  if (IS_DEMO) throw new Error("Billing isn't available in demo mode — sign up for a real account first.");

  const sb = getSupabaseBrowserClient();
  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sign in first to upgrade your plan.");

  const url = import.meta.env["VITE_SUPABASE_URL"];
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

  const res = await fetch(`${url}/functions/v1/razorpay-create-subscription`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ planKey, cycle }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => undefined);
    throw new Error(detail || "Couldn't start checkout.");
  }
  const { subscriptionId, keyId, prefill } = await res.json();

  await loadRazorpayScript();

  const rzp = new window.Razorpay({
    key: keyId,
    subscription_id: subscriptionId,
    name: "Atlas Health",
    description: `${planKey === "pro" ? "Pro" : "Family"} plan · ${cycle}`,
    prefill,
    theme: { color: "#0e8a7a" },
    handler: () => onSuccess(),
  });
  rzp.open();
}

export async function cancelSubscription(): Promise<void> {
  if (IS_DEMO) return;
  const sb = getSupabaseBrowserClient();
  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Not signed in.");

  const url = import.meta.env["VITE_SUPABASE_URL"];
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];
  const res = await fetch(`${url}/functions/v1/razorpay-cancel-subscription`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => undefined);
    throw new Error(detail || "Couldn't cancel your subscription.");
  }
}

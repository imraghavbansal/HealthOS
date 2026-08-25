/**
 * Web Push subscription management - kept separate from lib/queries.ts
 * and lib/api/* the same way lib/auth.ts and lib/share.ts are, since this
 * is a browser capability (Notification/PushManager/ServiceWorker), not
 * domain data with a mock/http/supabase adapter split. Meaningless in
 * demo mode (no real backend to deliver to), so every function below
 * no-ops there.
 */
import { IS_DEMO } from "./api";
import { getSupabaseBrowserClient } from "./supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function getPushSubscriptionState(): Promise<
  "subscribed" | "unsubscribed" | "unsupported"
> {
  if (!isPushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "subscribed" : "unsubscribed";
}

export async function subscribeToPush(): Promise<void> {
  if (IS_DEMO) return;
  if (!isPushSupported()) throw new Error("Push notifications aren't supported in this browser.");
  if (!VAPID_PUBLIC_KEY)
    throw new Error("Push isn't configured yet (missing VITE_VAPID_PUBLIC_KEY).");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was denied.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys?.["auth"]) {
    throw new Error("Browser returned an incomplete push subscription.");
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys["p256dh"],
      auth_key: json.keys["auth"],
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function unsubscribeFromPush(): Promise<void> {
  if (IS_DEMO) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const supabase = getSupabaseBrowserClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/** Sends a test push to the signed-in user's own subscriptions. */
export async function sendTestPush(): Promise<void> {
  if (IS_DEMO) return;
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data, error } = await supabase.functions.invoke("send-push", {
    body: {
      userId: user.id,
      title: "Raag test notification",
      body: "Push notifications are working.",
    },
  });
  if (error) throw new Error(error.message);
  if (data?.status === "no_subscriptions")
    throw new Error("No active push subscription - enable push first.");
}

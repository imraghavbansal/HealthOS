// Raag — send-push
//
// Delivers a real Web Push notification to every device a user has
// subscribed from. Two callers, mirroring parse-record's auth pattern:
//   - the pg_net trigger in 0013_push_notifications.sql (fires on every
//     notifications insert), authenticated via X-Internal-Secret
//   - a signed-in user sending themselves a test push (Settings page),
//     authenticated via their own JWT
// Either way, service-role is used internally to read push_subscriptions
// (RLS would otherwise scope it to whoever's JWT is on the request, which
// is wrong for the trigger path — the trigger runs as the DB, not as the
// notification's recipient).
//
// Uses npm:web-push for VAPID signing + aes128gcm payload encryption
// (RFC 8291) rather than hand-rolling Web Push crypto — same reasoning
// as using npm:@supabase/supabase-js elsewhere instead of reimplementing
// its client.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function →
// "send-push" → paste this file → Deploy. Secrets needed:
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@yourdomain.com),
// and PUSH_TRIGGER_SECRET — same value as the 'push_trigger_secret' Vault
// entry from 0013_push_notifications.sql (same two-places-same-value
// pattern as INTERNAL_QUEUE_SECRET in parse-record).

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
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
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPublic || !vapidPrivate || !vapidSubject) {
      return json({ error: "Push not configured — missing VAPID secrets" }, 500);
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("Authorization");

    const { userId, title, body: bodyText } = await req.json();
    if (!userId || !title) return json({ error: "Missing userId or title" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authorize: either the trigger's shared secret (same value as the
    // 'push_trigger_secret' Vault entry the DB trigger reads — compared
    // here against this function's own env var, not queried from Vault,
    // since Vault's tables aren't exposed via PostgREST), or a caller who
    // IS the target user (self-test push from Settings).
    if (internalSecret) {
      if (internalSecret !== Deno.env.get("PUSH_TRIGGER_SECRET")) {
        return json({ error: "Invalid internal secret" }, 401);
      }
    } else if (authHeader) {
      const callerClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: authHeader } },
        },
      );
      const { data: userData, error: userErr } = await callerClient.auth.getUser();
      if (userErr || !userData.user || userData.user.id !== userId) {
        return json({ error: "You can only send a push to yourself" }, 403);
      }
    } else {
      return json({ error: "Missing auth" }, 401);
    }

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("user_id", userId);
    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) return json({ status: "no_subscriptions" });

    const payload = JSON.stringify({ title, body: bodyText ?? "", url: "/dashboard" });
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload,
        ),
      ),
    );

    // A 404/410 from the push service means the subscription is dead
    // (browser uninstalled, permission revoked) — clean those up so they
    // stop being retried forever.
    const deadIds: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const statusCode = (r.reason as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) deadIds.push(subs[i].id);
      }
    });
    if (deadIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", deadIds);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return json({ status: "sent", sent, total: subs.length, removedDead: deadIds.length });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// Atlas Health — delete-account
//
// A user can't delete their own auth.users row via the client SDK — that
// needs admin rights. This function is the one narrow, server-only place
// the service-role key is used, and it only ever acts on the exact caller
// whose own JWT it just verified — never an id supplied in the request
// body. Every table cascades from auth.users(id) on delete, so this
// removes the whole account: profile, health data, household, everything.
// Storage objects aren't covered by the FK cascade, so they're removed
// explicitly first.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function →
// "delete-account" → paste this file → Deploy. No extra secrets needed —
// SUPABASE_SERVICE_ROLE_KEY is auto-injected like SUPABASE_URL/ANON_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    // Identify the caller from their own session — never trust a client-
    // supplied user id for a destructive operation like this.
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: files } = await admin.storage.from("medical-records").list(callerId);
    if (files?.length) {
      await admin.storage.from("medical-records").remove(files.map((f) => `${callerId}/${f.name}`));
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(callerId);
    if (delErr) throw delErr;

    return json({ status: "deleted" });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

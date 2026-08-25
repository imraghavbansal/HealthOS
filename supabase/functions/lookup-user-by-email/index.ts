// Raag - lookup-user-by-email
//
// Granting a family member access to a health_subject needs their user
// id, but `profiles` RLS (profiles_self: id = auth.uid()) deliberately
// only lets a user read their own profile - nobody can otherwise look up
// another account by email, which is the right default (prevents user
// enumeration). This function is the one narrow, server-only exception:
// it takes an email, uses service-role to check if a Raag account exists
// for it, and returns only { found, userId, name } - never anything else
// about that account. Requires the CALLER to be signed in (so this can't
// be used for anonymous enumeration either), but doesn't use the
// caller's identity for anything beyond that gate.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function →
// "lookup-user-by-email" → paste this file → Deploy.

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

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const { email } = await req.json();
    if (!email || typeof email !== "string") return json({ error: "Missing email" }, 400);

    if (email.trim().toLowerCase() === userData.user.email?.toLowerCase()) {
      return json({ error: "You can't grant access to your own account." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile, error: lookupErr } = await admin
      .from("profiles")
      .select("id, name")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    if (!profile) return json({ found: false });
    return json({ found: true, userId: profile.id, name: profile.name });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

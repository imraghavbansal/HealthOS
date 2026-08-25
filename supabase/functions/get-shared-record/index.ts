// Raag - get-shared-record
//
// The public, unauthenticated side of the share-links feature (see
// 0010_share_links.sql). The viewer (a doctor, a family member) has no
// Raag account and no Supabase session - this function is the only way
// they ever touch the data, and it never uses the caller's identity for
// authorization, only the token itself. Service-role throughout, because
// RLS has nothing to authorize an anonymous viewer against.
//
// Every access - success or failure - that reaches a real token lookup is
// logged (share_link_access_log), and last_accessed_at/access_count are
// updated, so the owner's management UI shows genuine access history, not
// a static "created" timestamp.
//
// Deliberately excludes uploaded documents/files at every scope level -
// only structured, already-reviewed data (labs, meds, vitals, conditions)
// is ever shared this way. Raw source documents can contain more than the
// owner intended to hand out via a link; that's a decision for a future
// iteration, not a default.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function →
// "get-shared-record" → paste this file → Deploy.

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
    const { token } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "Missing token" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkErr } = await admin
      .from("share_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) return json({ error: "This link doesn't exist or was deleted." }, 404);
    if (link.revoked_at) return json({ error: "This link has been revoked by its owner." }, 410);
    if (new Date(link.expires_at).getTime() < Date.now())
      return json({ error: "This link has expired." }, 410);

    // Log + counters first - record the attempt even if data assembly
    // below somehow fails, so the owner's access history is honest.
    await admin
      .from("share_link_access_log")
      .insert({ share_link_id: link.id, user_agent: req.headers.get("user-agent") ?? null });
    await admin
      .from("share_links")
      .update({ last_accessed_at: new Date().toISOString(), access_count: link.access_count + 1 })
      .eq("id", link.id);

    const subjectId = link.subject_id;
    const scope = link.scope as "summary" | "labs" | "medications" | "full";

    const { data: subject } = await admin
      .from("health_subjects")
      .select("name, date_of_birth, sex, blood_type")
      .eq("id", subjectId)
      .single();

    const { data: conditions } = await admin
      .from("conditions")
      .select("name, status, diagnosed_at")
      .eq("subject_id", subjectId)
      .in("status", ["active", "chronic"]);

    const { data: medications } = await admin
      .from("medications")
      .select("id, name, dose, schedule, type, active")
      .eq("subject_id", subjectId)
      .eq("active", true);

    const { data: latestVitals } = await admin
      .from("vitals")
      .select("kind, value, secondary, unit, recorded_at")
      .eq("subject_id", subjectId)
      .order("recorded_at", { ascending: false })
      .limit(20);

    // One most-recent reading per kind, not the raw last-20 rows.
    const vitalsSnapshot = Object.values(
      (latestVitals ?? []).reduce((acc: Record<string, unknown>, v) => {
        if (!acc[v.kind]) acc[v.kind] = v;
        return acc;
      }, {}),
    );

    const age = subject?.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(subject.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
        )
      : null;

    const result: Record<string, unknown> = {
      subjectName: subject?.name ?? "Unknown",
      age,
      sex: subject?.sex ?? null,
      bloodType: subject?.blood_type ?? null,
      activeConditions: conditions ?? [],
      currentMedications: medications ?? [],
      latestVitals: vitalsSnapshot,
      scope,
      generatedAt: new Date().toISOString(),
    };

    if (scope === "labs" || scope === "full") {
      const { data: labs } = await admin
        .from("lab_markers")
        .select("name, value, unit, range_low, range_high, collected_at")
        .eq("subject_id", subjectId)
        .order("collected_at", { ascending: false })
        .limit(100);
      result["labMarkers"] = labs ?? [];
    }

    if (scope === "medications" || scope === "full") {
      const medIds = (medications ?? []).map((m) => m.id);
      let doseLogs: { medication_id: string; taken_at: string; skipped: boolean }[] = [];
      if (medIds.length > 0) {
        const { data } = await admin
          .from("dose_logs")
          .select("medication_id, taken_at, skipped")
          .in("medication_id", medIds)
          .gte("taken_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        doseLogs = data ?? [];
      }
      result["doseLogs"] = doseLogs;
    }

    if (scope === "full") {
      const { data: symptoms } = await admin
        .from("symptoms")
        .select("label, severity, body_area, started_at")
        .eq("subject_id", subjectId)
        .order("started_at", { ascending: false })
        .limit(30);
      const { data: family } = await admin
        .from("family_history_entries")
        .select("relation, age, conditions")
        .eq("subject_id", subjectId);
      result["symptoms"] = symptoms ?? [];
      result["familyHistory"] = family ?? [];
    }

    return json(result);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

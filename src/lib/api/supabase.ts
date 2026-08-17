/**
 * Supabase adapter — real, persisted data. Schema + RLS: see
 * supabase/migrations/0001_init.sql. Product context: docs/PRODUCT-VISION.md.
 *
 * Scope note: a handful of RaagApi surfaces don't have a real data source
 * yet and are called out inline — they return honest empty/queued results
 * rather than fabricated demo data:
 *   - getSleep / getActivity: wait on wearable ingestion (roadmap V2)
 *   - getRisks / getInsights: wait on the rule-based risk & insight engine (V2)
 *   - sendChatMessage: wait on the `ai-chat` Edge Function (V2)
 * Everything else — profile, records, labs, meds, vitals, symptoms, goals,
 * appointments, nutrition, family history, notifications, care team — is
 * fully real today.
 */
import { getSupabaseBrowserClient } from "../supabase/client";
import { getMySubjectId, getCurrentUserId } from "../supabase/subject";
import { ageFromDob, initialsFromName, summarizeLabMarkers, computeAdherence, resolveContentType } from "../supabase/mappers";
import type { RaagApi } from "./contract";
import type {
  Appointment,
  AppNotification,
  CareTeamMember,
  ChatMessage,
  FamilyMember,
  Goal,
  LifestyleProfile,
  Medication,
  MedicalRecord,
  NutritionEntry,
  SymptomEntry,
  UserProfile,
  VitalEntry,
} from "../types";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export const supabaseApi: RaagApi = {
  async getProfile() {
    const sb = getSupabaseBrowserClient();
    const userId = await getCurrentUserId();
    const [profileRes, subjectRes] = await Promise.all([
      sb.from("profiles").select("*").eq("id", userId).single(),
      sb.from("health_subjects").select("date_of_birth, sex, height_cm, weight_kg, blood_type").eq("id", userId).single(),
    ]);
    const profile = unwrap(profileRes) as { id: string; name: string; email: string; units: "metric" | "imperial"; timezone: string; plan: UserProfile["plan"]; avatar_url: string | null; onboarding_completed: boolean };
    const subject = unwrap(subjectRes) as { date_of_birth: string | null; sex: string | null; height_cm: number | null; weight_kg: number | null; blood_type: string | null };
    return {
      id: profile.id,
      name: profile.name,
      initials: initialsFromName(profile.name),
      email: profile.email,
      age: ageFromDob(subject.date_of_birth),
      dateOfBirth: subject.date_of_birth ?? undefined,
      sex: subject.sex ?? "",
      heightCm: subject.height_cm ?? undefined,
      weightKg: subject.weight_kg ?? undefined,
      bloodType: subject.blood_type ?? undefined,
      units: profile.units,
      timezone: profile.timezone,
      plan: profile.plan,
      avatarUrl: profile.avatar_url,
      onboardingCompleted: profile.onboarding_completed,
    } satisfies UserProfile;
  },

  async updateProfile(patch) {
    const sb = getSupabaseBrowserClient();
    const userId = await getCurrentUserId();
    const profilePatch: Record<string, unknown> = {};
    if (patch.name !== undefined) profilePatch["name"] = patch.name;
    if (patch.units !== undefined) profilePatch["units"] = patch.units;
    if (patch.timezone !== undefined) profilePatch["timezone"] = patch.timezone;
    if (patch.avatarUrl !== undefined) profilePatch["avatar_url"] = patch.avatarUrl;
    if (patch.onboardingCompleted !== undefined) profilePatch["onboarding_completed"] = patch.onboardingCompleted;
    if (Object.keys(profilePatch).length > 0) {
      unwrap(await sb.from("profiles").update(profilePatch).eq("id", userId));
    }
    const subjectPatch: Record<string, unknown> = {};
    if (patch.sex !== undefined) subjectPatch["sex"] = patch.sex;
    if (patch.dateOfBirth !== undefined) subjectPatch["date_of_birth"] = patch.dateOfBirth;
    if (patch.heightCm !== undefined) subjectPatch["height_cm"] = patch.heightCm;
    if (patch.weightKg !== undefined) subjectPatch["weight_kg"] = patch.weightKg;
    if (patch.bloodType !== undefined) subjectPatch["blood_type"] = patch.bloodType;
    if (Object.keys(subjectPatch).length > 0) {
      unwrap(await sb.from("health_subjects").update(subjectPatch).eq("id", userId));
    }
    return supabaseApi.getProfile();
  },

  async getHealthScore() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const [labsRes, dosesRes] = await Promise.all([
      sb.from("lab_markers").select("value, range_low, range_high, collected_at, name").eq("subject_id", subjectId),
      sb.from("dose_logs").select("taken_at, skipped").eq("subject_id", subjectId),
    ]);
    const labRows = unwrap(labsRes) as { value: number; range_low: number | null; range_high: number | null }[];
    const doseRows = unwrap(dosesRes) as { taken_at: string; skipped: boolean }[];

    const inRange = labRows.filter(
      (r) => (r.range_low == null || r.value >= r.range_low) && (r.range_high == null || r.value <= r.range_high),
    ).length;
    const labsPillar = labRows.length ? Math.round((inRange / labRows.length) * 100) : 0;
    const adherencePillar = computeAdherence(doseRows);

    // Sleep/Activity pillars wait on wearable ingestion (V2) — 0 is honest
    // for "no data yet", not a placeholder demo value.
    const pillars = [
      { label: "Sleep", value: 0, weight: 0.25 },
      { label: "Activity", value: 0, weight: 0.25 },
      { label: "Labs", value: labsPillar, weight: 0.25 },
      { label: "Adherence", value: adherencePillar, weight: 0.25 },
    ];
    const score = Math.round(pillars.reduce((sum, p) => sum + p.value * p.weight, 0));
    return { score, delta: 0, lastSync: new Date().toISOString(), pillars };
  },

  // No insight-generation engine yet (V2 rule-based risk & insight engine).
  // Real, persisted, currently empty until that ships — not fabricated.
  async getInsights() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("insights").select("*").eq("subject_id", subjectId).eq("dismissed", false).order("created_at", { ascending: false }),
    ) as { id: string; title: string; body: string; severity: string; created_at: string }[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      severity: r.severity as "info" | "success" | "warning" | "critical",
      createdAt: r.created_at,
    }));
  },

  // Wait on wearable sync (V2) — no fabricated series in the meantime.
  async getSleep() {
    return [];
  },
  async getActivity() {
    return [];
  },

  async getLabMarkers() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb
        .from("lab_markers")
        .select("id, name, value, unit, range_low, range_high, collected_at")
        .eq("subject_id", subjectId)
        .order("collected_at", { ascending: true }),
    ) as { id: string; name: string; value: number; unit: string; range_low: number | null; range_high: number | null; collected_at: string }[];
    return summarizeLabMarkers(rows);
  },

  async getLabTrend(marker) {
    const markers = await supabaseApi.getLabMarkers();
    return markers.find((m) => m.name === marker)?.history ?? [];
  },

  async getRecords() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("source_documents").select("*").eq("subject_id", subjectId).order("document_date", { ascending: false }),
    ) as {
      id: string; document_type: string; title: string; provider: string | null; document_date: string | null;
      storage_path: string; size_kb: number; summary: string | null; ocr_status: MedicalRecord["parseStatus"];
    }[];

    const { data: signedUrls } = rows.length
      ? await sb.storage.from("medical-records").createSignedUrls(rows.map((r) => r.storage_path), 60 * 60)
      : { data: [] as { path: string | null; signedUrl: string }[] };
    const urlByPath = new Map((signedUrls ?? []).map((s) => [s.path, s.signedUrl]));

    return rows.map(
      (r): MedicalRecord => ({
        id: r.id,
        type: r.document_type,
        title: r.title,
        provider: r.provider ?? "—",
        date: r.document_date ?? "",
        tag: r.document_type,
        fileUrl: urlByPath.get(r.storage_path) ?? null,
        sizeKb: r.size_kb,
        summary: r.summary ?? undefined,
        parseStatus: r.ocr_status,
      }),
    );
  },

  async uploadRecord(file) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const userId = await getCurrentUserId();
    // Path convention `<subject_id>/...` is load-bearing — the Storage RLS
    // policies (0004_storage.sql) key off the leading folder segment.
    const path = `${subjectId}/${Date.now()}-${file.name}`;

    const contentType = resolveContentType(file);
    const { error: uploadErr } = await sb.storage.from("medical-records").upload(path, file, { contentType });
    if (uploadErr) throw uploadErr;

    const row = unwrap(
      await sb
        .from("source_documents")
        .insert({
          subject_id: subjectId,
          storage_path: path,
          original_filename: file.name,
          mime_type: contentType,
          size_kb: Math.round(file.size / 1024),
          document_type: "Other",
          title: file.name.replace(/\.[a-z0-9]+$/i, ""),
          ocr_status: "pending",
          uploaded_by: userId,
        })
        .select()
        .single(),
    ) as { id: string; document_type: string; title: string; provider: string | null; document_date: string | null; size_kb: number; summary: string | null };

    // Fire-and-forget: parsing can take several seconds (Claude reads the
    // whole document) and shouldn't block the upload UI. ocr_status on the
    // row tracks progress; refetching records picks up the result.
    sb.functions.invoke("parse-record", { body: { documentId: row.id } }).catch((err) => {
      console.error("parse-record invoke failed", err);
    });

    const { data: signed } = await sb.storage.from("medical-records").createSignedUrl(path, 60 * 60);
    return {
      id: row.id,
      type: row.document_type,
      title: row.title,
      provider: row.provider ?? "Uploaded by you",
      date: row.document_date ?? new Date().toISOString(),
      tag: row.document_type,
      fileUrl: signed?.signedUrl ?? null,
      sizeKb: row.size_kb,
      summary: row.summary ?? "Queued for AI parsing.",
      parseStatus: "pending",
    };
  },

  async deleteRecord(id) {
    const sb = getSupabaseBrowserClient();
    const { data: rec } = await sb.from("source_documents").select("storage_path").eq("id", id).single();
    unwrap(await sb.from("source_documents").delete().eq("id", id));
    if (rec?.storage_path) await sb.storage.from("medical-records").remove([rec.storage_path]);
  },

  // Real per-provider connect state; the OAuth handshake itself is a V2
  // Edge Function (Vital/Terra) — this table already tracks the outcome.
  async getWearables() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("wearable_connections").select("*").eq("subject_id", subjectId),
    ) as { provider: string; connected: boolean; last_sync_at: string | null }[];
    return rows.map((r) => ({
      name: r.provider,
      desc: "",
      connected: r.connected,
      last: r.last_sync_at ?? "—",
      color: "",
    }));
  },
  async toggleWearable(name, connect) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb
        .from("wearable_connections")
        .upsert(
          { subject_id: subjectId, provider: name, connected: connect, last_sync_at: connect ? new Date().toISOString() : null },
          { onConflict: "subject_id,provider" },
        )
        .select()
        .single(),
    ) as { provider: string; connected: boolean; last_sync_at: string | null };
    return { name: row.provider, desc: "", connected: row.connected, last: row.last_sync_at ?? "—", color: "" };
  },

  async getMedications() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const [medsRes, dosesRes] = await Promise.all([
      sb.from("medications").select("*").eq("subject_id", subjectId).eq("active", true),
      sb.from("dose_logs").select("medication_id, taken_at, skipped").eq("subject_id", subjectId),
    ]);
    const meds = unwrap(medsRes) as { id: string; name: string; dose: string | null; schedule: string | null; type: string; refills_left: number | null; interactions: string[] | null }[];
    const doses = unwrap(dosesRes) as { medication_id: string; taken_at: string; skipped: boolean }[];
    return meds.map(
      (m): Medication => ({
        id: m.id,
        name: m.name,
        dose: m.dose ?? "",
        schedule: m.schedule ?? "",
        adherence: computeAdherence(doses.filter((d) => d.medication_id === m.id)),
        next: "—",
        type: m.type,
        refillsLeft: m.refills_left ?? undefined,
        interactions: m.interactions ?? undefined,
      }),
    );
  },

  async logDose(medicationId, taken) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    unwrap(await sb.from("dose_logs").insert({ medication_id: medicationId, subject_id: subjectId, skipped: !taken }));
    const meds = await supabaseApi.getMedications();
    return meds.find((m) => m.id === medicationId)!;
  },

  async addMedication(input) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb
        .from("medications")
        .insert({ subject_id: subjectId, name: input.name, dose: input.dose, schedule: input.schedule, type: input.type })
        .select()
        .single(),
    ) as { id: string; name: string; dose: string | null; schedule: string | null; type: string };
    return { id: row.id, name: row.name, dose: row.dose ?? "", schedule: row.schedule ?? "", adherence: 100, next: "—", type: row.type };
  },

  async getGoals() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("goals").select("*").eq("subject_id", subjectId).order("created_at", { ascending: false }),
    ) as { id: string; title: string; category: string; target: string | null; due_date: string | null; progress: number; streak: number }[];
    return rows.map(
      (g): Goal => ({ id: g.id, title: g.title, category: g.category, target: g.target ?? undefined, dueDate: g.due_date ?? undefined, progress: g.progress, streak: g.streak }),
    );
  },
  async addGoal(input) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb
        .from("goals")
        .insert({ subject_id: subjectId, title: input.title, category: input.category, target: input.target, due_date: input.dueDate })
        .select()
        .single(),
    ) as { id: string; title: string; category: string; target: string | null; due_date: string | null };
    return { id: row.id, title: row.title, category: row.category, target: row.target ?? undefined, dueDate: row.due_date ?? undefined, progress: 0, streak: 0 };
  },
  async updateGoal(id, patch) {
    const sb = getSupabaseBrowserClient();
    const dbPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) dbPatch["title"] = patch.title;
    if (patch.progress !== undefined) dbPatch["progress"] = patch.progress;
    if (patch.streak !== undefined) dbPatch["streak"] = patch.streak;
    if (patch.target !== undefined) dbPatch["target"] = patch.target;
    if (patch.dueDate !== undefined) dbPatch["due_date"] = patch.dueDate;
    const row = unwrap(await sb.from("goals").update(dbPatch).eq("id", id).select().single()) as {
      id: string; title: string; category: string; target: string | null; due_date: string | null; progress: number; streak: number;
    };
    return { id: row.id, title: row.title, category: row.category, target: row.target ?? undefined, dueDate: row.due_date ?? undefined, progress: row.progress, streak: row.streak };
  },
  async deleteGoal(id) {
    const sb = getSupabaseBrowserClient();
    unwrap(await sb.from("goals").delete().eq("id", id));
  },

  async getFamilyHistory() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("family_history_entries").select("*").eq("subject_id", subjectId),
    ) as { id: string; relation: string; age: number | null; conditions: string[] | null }[];
    return rows.map((r): FamilyMember => ({ id: r.id, relation: r.relation, age: r.age ?? 0, conditions: r.conditions ?? [] }));
  },
  async addFamilyMember(input) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb
        .from("family_history_entries")
        .insert({ subject_id: subjectId, relation: input.relation, age: input.age, conditions: input.conditions })
        .select()
        .single(),
    ) as { id: string; relation: string; age: number | null; conditions: string[] | null };
    return { id: row.id, relation: row.relation, age: row.age ?? 0, conditions: row.conditions ?? [] };
  },

  // Rule-based risk engine is V2 — real table, honestly empty until then.
  async getRisks() {
    return [];
  },

  async getLifestyleProfile() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb.from("lifestyle_profile").select("alcohol, smoking, exercise, diet").eq("subject_id", subjectId).single(),
    ) as LifestyleProfile;
    return { alcohol: row.alcohol ?? undefined, smoking: row.smoking ?? undefined, exercise: row.exercise ?? undefined, diet: row.diet ?? undefined };
  },
  async updateLifestyleProfile(patch) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    unwrap(await sb.from("lifestyle_profile").update({ ...patch, updated_at: new Date().toISOString() }).eq("subject_id", subjectId));
    return supabaseApi.getLifestyleProfile();
  },

  async getAppointments() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("appointments").select("*").eq("subject_id", subjectId).order("start_at", { ascending: true }),
    ) as { id: string; title: string; provider: string | null; specialty: string | null; start_at: string; duration_min: number; location: string | null; mode: Appointment["mode"]; status: Appointment["status"]; prep_notes: string[] | null }[];
    return rows.map(
      (a): Appointment => ({
        id: a.id, title: a.title, provider: a.provider ?? "", specialty: a.specialty ?? "", start: a.start_at,
        durationMin: a.duration_min, location: a.location ?? "", mode: a.mode, status: a.status, prepNotes: a.prep_notes ?? undefined,
      }),
    );
  },
  async addAppointment(input) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb
        .from("appointments")
        .insert({
          subject_id: subjectId, title: input.title, provider: input.provider, specialty: input.specialty,
          start_at: input.start, duration_min: input.durationMin, location: input.location, mode: input.mode, prep_notes: input.prepNotes,
        })
        .select()
        .single(),
    ) as { id: string; title: string; provider: string | null; specialty: string | null; start_at: string; duration_min: number; location: string | null; mode: Appointment["mode"]; prep_notes: string[] | null };
    return {
      id: row.id, title: row.title, provider: row.provider ?? "", specialty: row.specialty ?? "", start: row.start_at,
      durationMin: row.duration_min, location: row.location ?? "", mode: row.mode, status: "upcoming", prepNotes: row.prep_notes ?? undefined,
    };
  },
  async cancelAppointment(id) {
    const sb = getSupabaseBrowserClient();
    unwrap(await sb.from("appointments").update({ status: "cancelled" }).eq("id", id));
  },

  async getVitals(kind) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    let query = sb.from("vitals").select("*").eq("subject_id", subjectId).order("recorded_at", { ascending: false });
    if (kind) query = query.eq("kind", kind);
    const rows = unwrap(await query) as { id: string; kind: VitalEntry["kind"]; value: number; secondary: number | null; unit: string; recorded_at: string; note: string | null; source: VitalEntry["source"] }[];
    return rows.map((v): VitalEntry => ({ id: v.id, kind: v.kind, value: v.value, secondary: v.secondary ?? undefined, unit: v.unit, recordedAt: v.recorded_at, note: v.note ?? undefined, source: v.source }));
  },
  async addVital(input) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb
        .from("vitals")
        .insert({ subject_id: subjectId, kind: input.kind, value: input.value, secondary: input.secondary, unit: input.unit, recorded_at: input.recordedAt, note: input.note, source: input.source ?? "manual" })
        .select()
        .single(),
    ) as { id: string; kind: VitalEntry["kind"]; value: number; secondary: number | null; unit: string; recorded_at: string; note: string | null; source: VitalEntry["source"] };
    return { id: row.id, kind: row.kind, value: row.value, secondary: row.secondary ?? undefined, unit: row.unit, recordedAt: row.recorded_at, note: row.note ?? undefined, source: row.source };
  },

  async getSymptoms() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("symptoms").select("*").eq("subject_id", subjectId).order("started_at", { ascending: false }),
    ) as { id: string; label: string; severity: number; body_area: string | null; started_at: string; tags: string[] | null; note: string | null }[];
    return rows.map((s): SymptomEntry => ({ id: s.id, label: s.label, severity: s.severity, bodyArea: s.body_area ?? "", startedAt: s.started_at, tags: s.tags ?? [], note: s.note ?? undefined }));
  },
  async addSymptom(input) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb
        .from("symptoms")
        .insert({ subject_id: subjectId, label: input.label, severity: input.severity, body_area: input.bodyArea, started_at: input.startedAt, tags: input.tags, note: input.note })
        .select()
        .single(),
    ) as { id: string; label: string; severity: number; body_area: string | null; started_at: string; tags: string[] | null; note: string | null };
    return { id: row.id, label: row.label, severity: row.severity, bodyArea: row.body_area ?? "", startedAt: row.started_at, tags: row.tags ?? [], note: row.note ?? undefined };
  },
  async deleteSymptom(id) {
    const sb = getSupabaseBrowserClient();
    unwrap(await sb.from("symptoms").delete().eq("id", id));
  },

  async getNutrition(date) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const dayStart = date ? new Date(date) : new Date(new Date().toDateString());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const [entriesRes, targetsRes, waterRes] = await Promise.all([
      sb.from("nutrition_entries").select("*").eq("subject_id", subjectId).gte("logged_at", dayStart.toISOString()).lt("logged_at", dayEnd.toISOString()),
      sb.from("nutrition_targets").select("*").eq("subject_id", subjectId).single(),
      sb.from("water_logs").select("ml").eq("subject_id", subjectId).gte("logged_at", dayStart.toISOString()).lt("logged_at", dayEnd.toISOString()),
    ]);
    const entries = unwrap(entriesRes) as { id: string; meal: NutritionEntry["meal"]; name: string; kcal: number; protein: number; carbs: number; fat: number; logged_at: string }[];
    const targets = unwrap(targetsRes) as { kcal: number; protein: number; carbs: number; fat: number; water_ml: number };
    const waterLogs = unwrap(waterRes) as { ml: number }[];
    return {
      entries: entries.map((e) => ({ id: e.id, meal: e.meal, name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, loggedAt: e.logged_at })),
      targets: { kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat, waterMl: targets.water_ml },
      waterMl: waterLogs.reduce((sum, w) => sum + w.ml, 0),
    };
  },
  async addNutrition(input) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const row = unwrap(
      await sb
        .from("nutrition_entries")
        .insert({ subject_id: subjectId, meal: input.meal, name: input.name, kcal: input.kcal, protein: input.protein, carbs: input.carbs, fat: input.fat })
        .select()
        .single(),
    ) as { id: string; meal: NutritionEntry["meal"]; name: string; kcal: number; protein: number; carbs: number; fat: number; logged_at: string };
    return { id: row.id, meal: row.meal, name: row.name, kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat, loggedAt: row.logged_at };
  },
  async addWater(ml) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    unwrap(await sb.from("water_logs").insert({ subject_id: subjectId, ml }));
    const { waterMl } = await supabaseApi.getNutrition();
    return waterMl;
  },

  // Cross-domain feed. v1: union the tables that already carry a date; a
  // dedicated `timeline` materialized view is a straightforward follow-up
  // once this shape is validated against real usage.
  async getTimeline() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const [labs, records, meds, appts] = await Promise.all([
      sb.from("lab_markers").select("id, name, value, unit, collected_at").eq("subject_id", subjectId),
      sb.from("source_documents").select("id, title, document_type, document_date").eq("subject_id", subjectId),
      sb.from("medications").select("id, name, dose, created_at").eq("subject_id", subjectId),
      sb.from("appointments").select("id, title, provider, start_at").eq("subject_id", subjectId),
    ]);
    type TimelineEventRow = { id: string; date: string; kind: "lab" | "visit" | "med" | "vital" | "goal" | "device" | "note"; title: string; detail: string };
    const events: TimelineEventRow[] = [
      ...(unwrap(labs) as { id: string; name: string; value: number; unit: string; collected_at: string }[]).map((l) => ({ id: l.id, date: l.collected_at, kind: "lab" as const, title: l.name, detail: `${l.value} ${l.unit}` })),
      ...(unwrap(records) as { id: string; title: string; document_type: string; document_date: string | null }[]).map((r) => ({ id: r.id, date: r.document_date ?? "", kind: "note" as const, title: r.title, detail: r.document_type })),
      ...(unwrap(meds) as { id: string; name: string; dose: string | null; created_at: string }[]).map((m) => ({ id: m.id, date: m.created_at, kind: "med" as const, title: m.name, detail: m.dose ?? "" })),
      ...(unwrap(appts) as { id: string; title: string; provider: string | null; start_at: string }[]).map((a) => ({ id: a.id, date: a.start_at, kind: "visit" as const, title: a.title, detail: a.provider ?? "" })),
    ];
    return events.filter((e) => e.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getNotifications() {
    const sb = getSupabaseBrowserClient();
    const userId = await getCurrentUserId();
    const rows = unwrap(
      await sb.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ) as { id: string; title: string; body: string; created_at: string; read: boolean; kind: AppNotification["kind"] }[];
    return rows.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.created_at, read: n.read, kind: n.kind }));
  },
  async markNotificationRead(id) {
    const sb = getSupabaseBrowserClient();
    unwrap(await sb.from("notifications").update({ read: true }).eq("id", id));
  },
  async markAllNotificationsRead() {
    const sb = getSupabaseBrowserClient();
    const userId = await getCurrentUserId();
    unwrap(await sb.from("notifications").update({ read: true }).eq("user_id", userId));
  },

  // Care-team-as-contact-list. Note: cross-household clinician *access*
  // (a doctor logging in and seeing shared records) is the access_grants
  // system in the schema, not this table — this is the visible contact +
  // "am I sharing with them" toggle in Settings.
  async getCareTeam() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("care_team").select("*").eq("subject_id", subjectId),
    ) as { id: string; name: string; role: string; org: string; phone: string; sharing: boolean }[];
    return rows.map((c): CareTeamMember => ({ id: c.id, name: c.name, role: c.role, org: c.org, phone: c.phone, sharing: c.sharing }));
  },
  async setCareSharing(id, sharing) {
    const sb = getSupabaseBrowserClient();
    const row = unwrap(await sb.from("care_team").update({ sharing }).eq("id", id).select().single()) as { id: string; name: string; role: string; org: string; phone: string; sharing: boolean };
    return { id: row.id, name: row.name, role: row.role, org: row.org, phone: row.phone, sharing: row.sharing };
  },

  // Report generation runs server-side (Edge Function) so it can pull
  // Storage + Postgres together; this just queues the job.
  async requestReport(req) {
    const sb = getSupabaseBrowserClient();
    const { data, error } = await sb.functions.invoke("request-report", { body: req });
    if (error) throw error;
    return data as { id: string; status: "queued" };
  },

  async getConsentSettings() {
    const sb = getSupabaseBrowserClient();
    const userId = await getCurrentUserId();
    const row = unwrap(
      await sb.from("consent_settings").select("*").eq("user_id", userId).single(),
    ) as { share_deidentified: boolean; ai_use_family_history: boolean; share_with_pcp: boolean; pcp_contact: string | null };
    return {
      shareDeidentified: row.share_deidentified,
      aiUseFamilyHistory: row.ai_use_family_history,
      shareWithPcp: row.share_with_pcp,
      pcpContact: row.pcp_contact ?? undefined,
    };
  },
  async updateConsentSettings(patch) {
    const sb = getSupabaseBrowserClient();
    const userId = await getCurrentUserId();
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.shareDeidentified !== undefined) dbPatch["share_deidentified"] = patch.shareDeidentified;
    if (patch.aiUseFamilyHistory !== undefined) dbPatch["ai_use_family_history"] = patch.aiUseFamilyHistory;
    if (patch.shareWithPcp !== undefined) dbPatch["share_with_pcp"] = patch.shareWithPcp;
    if (patch.pcpContact !== undefined) dbPatch["pcp_contact"] = patch.pcpContact;
    unwrap(await sb.from("consent_settings").update(dbPatch).eq("user_id", userId));
    return supabaseApi.getConsentSettings();
  },

  async getNotificationPreferences() {
    const sb = getSupabaseBrowserClient();
    const userId = await getCurrentUserId();
    const row = unwrap(
      await sb.from("notification_preferences").select("*").eq("user_id", userId).single(),
    ) as { medication_reminders: boolean; weekly_brief: boolean; new_lab_results: boolean; trend_alerts: boolean };
    return {
      medicationReminders: row.medication_reminders,
      weeklyBrief: row.weekly_brief,
      newLabResults: row.new_lab_results,
      trendAlerts: row.trend_alerts,
    };
  },
  async updateNotificationPreferences(patch) {
    const sb = getSupabaseBrowserClient();
    const userId = await getCurrentUserId();
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.medicationReminders !== undefined) dbPatch["medication_reminders"] = patch.medicationReminders;
    if (patch.weeklyBrief !== undefined) dbPatch["weekly_brief"] = patch.weeklyBrief;
    if (patch.newLabResults !== undefined) dbPatch["new_lab_results"] = patch.newLabResults;
    if (patch.trendAlerts !== undefined) dbPatch["trend_alerts"] = patch.trendAlerts;
    unwrap(await sb.from("notification_preferences").update(dbPatch).eq("user_id", userId));
    return supabaseApi.getNotificationPreferences();
  },

  async exportAllData() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const userId = await getCurrentUserId();
    const tableFilters: Record<string, { column: string; value: string }> = {
      profiles: { column: "id", value: userId },
      health_subjects: { column: "id", value: subjectId },
      consent_settings: { column: "user_id", value: userId },
      notification_preferences: { column: "user_id", value: userId },
      lifestyle_profile: { column: "subject_id", value: subjectId },
      source_documents: { column: "subject_id", value: subjectId },
      conditions: { column: "subject_id", value: subjectId },
      lab_markers: { column: "subject_id", value: subjectId },
      medications: { column: "subject_id", value: subjectId },
      dose_logs: { column: "subject_id", value: subjectId },
      vitals: { column: "subject_id", value: subjectId },
      symptoms: { column: "subject_id", value: subjectId },
      appointments: { column: "subject_id", value: subjectId },
      goals: { column: "subject_id", value: subjectId },
      nutrition_targets: { column: "subject_id", value: subjectId },
      nutrition_entries: { column: "subject_id", value: subjectId },
      water_logs: { column: "subject_id", value: subjectId },
      family_history_entries: { column: "subject_id", value: subjectId },
      wearable_connections: { column: "subject_id", value: subjectId },
      insights: { column: "subject_id", value: subjectId },
      chat_messages: { column: "subject_id", value: subjectId },
    };
    const entries = await Promise.all(
      Object.entries(tableFilters).map(async ([table, { column, value }]) => {
        const { data } = await sb.from(table).select("*").eq(column, value);
        return [table, data ?? []] as const;
      }),
    );
    return { exportedAt: new Date().toISOString(), ...Object.fromEntries(entries) };
  },

  async deleteAccount() {
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.functions.invoke("delete-account");
    if (error) throw error;
  },

  async getChatHistory() {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const rows = unwrap(
      await sb.from("chat_messages").select("*").eq("subject_id", subjectId).order("created_at", { ascending: true }),
    ) as { id: string; role: ChatMessage["role"]; content: string; citations: ChatMessage["citations"] | null; created_at: string }[];
    return rows.map((m) => ({ id: m.id, role: m.role, content: m.content, citations: m.citations ?? undefined, createdAt: m.created_at }));
  },

  // The actual grounding (structured-data queries + document retrieval +
  // Claude) lives in the `ai-chat` Edge Function — see docs/raag-architecture
  // for the two-path retrieval design. This just persists + invokes it.
  async sendChatMessage(content, onDelta) {
    const sb = getSupabaseBrowserClient();
    const subjectId = await getMySubjectId();
    const userId = await getCurrentUserId();
    unwrap(await sb.from("chat_messages").insert({ subject_id: subjectId, user_id: userId, role: "user", content }));

    // functions.invoke() buffers the whole response — a real token stream
    // needs a raw fetch against the function URL so the reader sees bytes
    // as they arrive.
    const { data: sessionData } = await sb.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Not signed in.");

    const url = import.meta.env["VITE_SUPABASE_URL"];
    const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];
    const res = await fetch(`${url}/functions/v1/ai-chat`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ subjectId, content }),
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => undefined);
      throw new Error(detail || `ai-chat request failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let final: { id: string; citations: ChatMessage["citations"]; createdAt: string } | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.type === "delta") {
          accumulated += event.text;
          onDelta?.(event.text);
        }
        if (event.type === "done") final = event;
        if (event.type === "error") throw new Error(event.error);
      }
    }
    if (!final) throw new Error("Stream ended without a final message");
    return { id: final.id, role: "assistant", content: accumulated, citations: final.citations, createdAt: final.createdAt };
  },
};

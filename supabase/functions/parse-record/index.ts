// Raag — parse-record
//
// Runs after a document upload. Reads the file, asks Claude to extract
// structured facts, and writes them into the real domain tables — each row
// linked back to the source document it came from (source_document_id),
// with verified_by_user defaulting to false. Per docs/PRODUCT-VISION.md:
// the original file is never overwritten or discarded; extracted facts are
// a separate, provenance-tracked layer on top of it, not a replacement.
//
// Two invocation paths: the uploading user's own client (their forwarded
// JWT against the anon key — RLS applies, no elevated bypass), or the
// internal pg_cron retry sweep (0006_ingestion_queue.sql), identified by
// an X-Internal-Secret header and scoped to the service role only for that
// one already-existing documentId. See the auth branch below.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function → "parse-record"
// → paste this file → Deploy. Secrets needed: ANTHROPIC_API_KEY (existing)
// and INTERNAL_QUEUE_SECRET (new — see 0006_ingestion_queue.sql).
//
// Scope note: this extracts structured facts (lab values, conditions,
// medications) only. Semantic search over free-text document content
// (record_embeddings) needs a separate embeddings provider — Anthropic
// doesn't offer one — and is a deliberate follow-up, not done here.

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}

const EXTRACTION_TOOL = {
  name: "record_extraction",
  description: "Structured facts found in a medical record document. Only include what is explicitly present — never infer or estimate a value that isn't stated.",
  input_schema: {
    type: "object" as const,
    properties: {
      documentType: { type: "string", enum: ["Labs", "Imaging", "Rx", "Visit", "Vax", "Other"] },
      documentDate: { type: "string", description: "ISO date (YYYY-MM-DD) the document/results are dated, if stated. Omit if not found." },
      provider: { type: "string", description: "Issuing clinic, lab, or physician name, if stated." },
      summary: { type: "string", description: "One or two plain-language sentences describing what this document is." },
      labMarkers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: { type: "number" },
            unit: { type: "string" },
            rangeLow: { type: "number" },
            rangeHigh: { type: "number" },
            collectedAt: { type: "string", description: "ISO date this specific value was collected, if stated." },
          },
          required: ["name", "value", "unit"],
        },
      },
      conditions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["active", "resolved", "chronic"] },
            diagnosedAt: { type: "string" },
          },
          required: ["name"],
        },
      },
      medications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            dose: { type: "string" },
            schedule: { type: "string" },
            type: { type: "string", enum: ["Supplement", "Prescription"] },
          },
          required: ["name"],
        },
      },
    },
    required: ["documentType", "summary", "labMarkers", "conditions", "medications"],
  },
};

const SYSTEM_PROMPT = `You extract structured facts from medical record documents (lab reports, prescriptions, visit summaries, imaging reports, vaccination records).

Rules:
- Only extract what is explicitly written in the document. Never infer, estimate, or fill in a plausible-looking value.
- If a section (lab markers, conditions, medications) has nothing relevant, return an empty array for it — do not omit the field.
- Normalize dates to ISO format (YYYY-MM-DD) when a date is present; omit the date field entirely if none is stated.
- This is informational extraction only, not a diagnosis or medical interpretation.`;

type ExtractionResult = {
  documentType: "Labs" | "Imaging" | "Rx" | "Visit" | "Vax" | "Other";
  documentDate?: string;
  provider?: string;
  summary: string;
  labMarkers: { name: string; value: number; unit: string; rangeLow?: number; rangeHigh?: number; collectedAt?: string }[];
  conditions: { name: string; status?: "active" | "resolved" | "chronic"; diagnosedAt?: string }[];
  medications: { name: string; dose?: string; schedule?: string; type?: "Supplement" | "Prescription" }[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  // Parsed once, up front, and reused in the catch block below — a Request
  // body can only be read once, so re-reading req.json()/req.clone() from
  // inside catch (after it's already been consumed here) silently fails
  // and the failure never gets recorded. Captured here instead.
  let documentId: string | undefined;
  let supabase: ReturnType<typeof createClient> | undefined;

  try {
    ({ documentId } = await req.json());
    if (!documentId) return json({ error: "documentId is required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    // Two trusted callers: the uploading user themselves (fast path, their
    // JWT forwarded, RLS applies as normal), or the internal pg_cron
    // retry sweep (0006_ingestion_queue.sql) — identified by a shared
    // secret only that job and this function's env know, never exposed to
    // any client. The internal path uses the service-role key, which is
    // safe here because it only ever touches the one already-existing
    // documentId the cron loop selected — no new attack surface.
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternalQueueCall = !!internalSecret && internalSecret === Deno.env.get("INTERNAL_QUEUE_SECRET");

    supabase = isInternalQueueCall
      ? createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
      : createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });

    const { data: doc, error: docErr } = await supabase.from("source_documents").select("*").eq("id", documentId).single();
    if (docErr || !doc) return json({ error: "Document not found or not accessible" }, 404);

    // Compliance: log the read regardless of which auth path triggered it
    // (fast client-invoke or the internal retry queue) — attributed to
    // whoever originally uploaded the document.
    await supabase.from("audit_log").insert({ actor_user_id: doc.uploaded_by, subject_id: doc.subject_id, action: "document_read_for_parsing", resource: "source_documents", resource_id: documentId });

    const isImage = doc.mime_type.startsWith("image/");
    const isPdf = doc.mime_type === "application/pdf";
    if (!isImage && !isPdf) {
      await supabase.from("source_documents").update({ ocr_status: "skipped", ocr_error: `Unsupported type for parsing: ${doc.mime_type}` }).eq("id", documentId);
      return json({ status: "skipped" });
    }

    await supabase.from("source_documents").update({ ocr_status: "processing" }).eq("id", documentId);

    const { data: fileBlob, error: dlErr } = await supabase.storage.from("medical-records").download(doc.storage_path);
    if (dlErr || !fileBlob) throw new Error(dlErr?.message ?? "Could not download the file from storage");
    const base64 = encodeBase64(new Uint8Array(await fileBlob.arrayBuffer()));

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "record_extraction" },
      // deno-lint-ignore no-explicit-any
      messages: [
        {
          role: "user",
          content: [
            {
              type: isImage ? "image" : "document",
              source: { type: "base64", media_type: doc.mime_type, data: base64 },
            },
            { type: "text", text: `Extract the structured facts from this ${isImage ? "photo of a" : ""} medical document.` },
          ],
        },
      ] as unknown as Anthropic.MessageParam[],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use") as { type: "tool_use"; input: unknown } | undefined;
    if (!toolUse) throw new Error("Claude did not return a structured extraction");
    const extracted = toolUse.input as ExtractionResult;

    const dayOf = (iso: string) => iso.slice(0, 10);

    if (extracted.labMarkers.length) {
      // Dedupe against markers already recorded for the same name on the
      // same day — a re-uploaded or overlapping report shouldn't double an
      // existing trend point.
      const names = [...new Set(extracted.labMarkers.map((m) => m.name))];
      const { data: existingLabs } = await supabase.from("lab_markers").select("name, collected_at").eq("subject_id", doc.subject_id).in("name", names);
      const existingLabKeys = new Set((existingLabs ?? []).map((r) => `${r.name}|${dayOf(r.collected_at)}`));

      const newLabMarkers = extracted.labMarkers.filter((m) => {
        const collectedAt = m.collectedAt ?? extracted.documentDate ?? doc.uploaded_at;
        return !existingLabKeys.has(`${m.name}|${dayOf(collectedAt)}`);
      });
      if (newLabMarkers.length) {
        await supabase.from("lab_markers").insert(
          newLabMarkers.map((m) => ({
            subject_id: doc.subject_id,
            name: m.name,
            value: m.value,
            unit: m.unit,
            range_low: m.rangeLow ?? null,
            range_high: m.rangeHigh ?? null,
            collected_at: m.collectedAt ?? extracted.documentDate ?? doc.uploaded_at,
            source_document_id: documentId,
            verified_by_user: false,
          })),
        );
      }
    }
    if (extracted.conditions.length) {
      // Dedupe by name — repeated documents often re-mention the same
      // ongoing condition; don't create a duplicate row each time.
      const { data: existingConditions } = await supabase.from("conditions").select("name").eq("subject_id", doc.subject_id);
      const existingNames = new Set((existingConditions ?? []).map((r) => r.name.toLowerCase()));
      const newConditions = extracted.conditions.filter((c) => !existingNames.has(c.name.toLowerCase()));
      if (newConditions.length) {
        await supabase.from("conditions").insert(
          newConditions.map((c) => ({
            subject_id: doc.subject_id,
            name: c.name,
            status: c.status ?? "active",
            diagnosed_at: c.diagnosedAt ?? null,
            source_document_id: documentId,
            verified_by_user: false,
          })),
        );
      }
    }
    if (extracted.medications.length) {
      // Dedupe against active medications with the same name — a repeat
      // visit summary mentioning an existing prescription shouldn't spawn
      // a second active entry.
      const { data: existingMeds } = await supabase.from("medications").select("name").eq("subject_id", doc.subject_id).eq("active", true);
      const existingMedNames = new Set((existingMeds ?? []).map((r) => r.name.toLowerCase()));
      const newMedications = extracted.medications.filter((m) => !existingMedNames.has(m.name.toLowerCase()));
      if (newMedications.length) {
        await supabase.from("medications").insert(
          newMedications.map((m) => ({
            subject_id: doc.subject_id,
            name: m.name,
            dose: m.dose ?? null,
            schedule: m.schedule ?? null,
            type: m.type ?? "Prescription",
            source_document_id: documentId,
          })),
        );
      }
    }

    await supabase
      .from("source_documents")
      .update({
        document_type: extracted.documentType,
        document_date: extracted.documentDate ?? doc.document_date,
        provider: extracted.provider ?? doc.provider,
        summary: extracted.summary,
        ocr_status: "done",
      })
      .eq("id", documentId);

    return json({
      status: "done",
      found: { labMarkers: extracted.labMarkers.length, conditions: extracted.conditions.length, medications: extracted.medications.length },
    });
  } catch (err) {
    console.error(err);
    if (documentId && supabase) {
      try {
        await supabase.from("source_documents").update({ ocr_status: "failed", ocr_error: String(err) }).eq("id", documentId);
      } catch (markErr) {
        console.error("also failed to mark ocr_status=failed:", markErr);
      }
    }
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

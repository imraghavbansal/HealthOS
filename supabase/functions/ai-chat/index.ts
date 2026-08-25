// Raag - ai-chat
//
// Grounds "Ask Raag" in the user's own structured data - not a blank-slate
// chatbot. Runs as the calling user (their forwarded JWT against the anon
// key), so the exact same RLS policies that protect every other read
// protect what this function can see.
//
// Streams the response as newline-delimited JSON (one small JSON object per
// line): {"type":"delta","text":"..."} while generating, then a single
// {"type":"done","id":...,"citations":[...],"createdAt":...} once the
// message is fully saved. Chosen over full SSE framing for a simpler
// client-side parser - still a real token stream, not a buffered response.
//
// Retrieval today is structured-data only: recent labs, active meds,
// vitals, symptoms, conditions, family history, and parsed-document
// summaries are assembled directly as context, each tagged with its row id
// so citations can reference sourceId/sourceTable. Semantic search over
// full document text (record_embeddings/pgvector) needs a separate
// embeddings provider - deliberately deferred, not done here (see
// parse-record's header comment for the same note).
//
// Deploy: Supabase Dashboard → Edge Functions → New Function → "ai-chat" →
// paste this file → Deploy. Reuses the ANTHROPIC_API_KEY secret already
// set for parse-record.

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32";

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

// ── Section 3 non-negotiable: escalate red-flag symptoms immediately,
// before anything else - deterministic keyword check, not a model call.
// Not exhaustive medical triage; a fast, reliable net for the clearest
// emergency phrasing. The system prompt below also asks the model to
// recognize subtler emergency language it might see in context.
const RED_FLAG_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /chest (pain|pressure|tightness)|crushing (chest|pain)/i,
    label: "possible cardiac emergency",
  },
  {
    pattern: /can'?t breathe|difficulty breathing|severe shortness of breath|gasping for air/i,
    label: "breathing emergency",
  },
  {
    pattern:
      /face (is )?droop|slurred speech|sudden numbness|sudden weakness|can'?t (move|feel) (my|one side)/i,
    label: "possible stroke",
  },
  {
    pattern: /want to (die|kill myself)|suicidal|suicide|end my life|self.?harm/i,
    label: "mental health crisis",
  },
  {
    pattern: /throat (is )?closing|can'?t swallow|severe allergic reaction|anaphylax/i,
    label: "possible anaphylaxis",
  },
  {
    pattern: /won'?t stop bleeding|uncontrolled bleeding|bleeding heavily/i,
    label: "severe bleeding",
  },
  { pattern: /overdose|took too many pills|poison(ed|ing)/i, label: "possible overdose/poisoning" },
  { pattern: /(having a |in a )?seizure|convulsing/i, label: "seizure" },
  { pattern: /passed out|lost consciousness|unresponsive/i, label: "loss of consciousness" },
];

const EMERGENCY_RESPONSE = `This sounds like it could be a medical emergency. Please act now, not later:

**Call your local emergency number immediately** - 911 (US), 112 (EU), 108 (India), or your country's equivalent - or go to the nearest emergency room.

If you're with someone else, ask them to stay with you and call for help. If you're having thoughts of harming yourself, you can also reach a crisis line: 988 (US Suicide & Crisis Lifeline), or search "crisis helpline" plus your country.

I'm not able to help with an active emergency - a real person needs to see you right now. This isn't a substitute for that.`;

function checkRedFlag(content: string): string | null {
  for (const { pattern } of RED_FLAG_PATTERNS) {
    if (pattern.test(content)) return EMERGENCY_RESPONSE;
  }
  return null;
}

const SYSTEM_PROMPT = `You are Raag, a personal health assistant. You help the user understand their own health history - you never diagnose, prescribe, or claim certainty a clinician would need to confirm.

Rules:
- Answer ONLY from the CONTEXT block below. Every context line ends with an id tag like [id:abc-123 table:lab_markers] - when you cite something, use that exact id and table.
- If the CONTEXT block is empty or says no data is logged, and the question is about the user's own health specifically, say plainly that there's nothing logged yet to answer that from, and suggest what would help (log vitals, add a medication, upload a report). You can still answer general questions about what Raag does without personal context.
- Never fabricate a lab value, date, medication, or id that isn't in the context. If you're not confident something is grounded, leave it out rather than guess.
- Reference specific values and dates from the context when relevant - be concrete, not vague.
- Keep responses tight: a few sentences to a short paragraph, not an essay.
- End every substantive clinical answer with a brief reminder that this is informational, not medical advice.
- If the user describes anything that could be a medical emergency (severe symptoms, thoughts of self-harm, an active crisis), stop and tell them to seek emergency help immediately instead of answering normally.
- After your prose response, on its own line, output a citations tag listing exactly what you drew from, in this exact format (empty array if nothing specific was cited):
<citations>[{"title":"Lipid Panel","date":"2026-08-15","sourceId":"abc-123","sourceTable":"lab_markers"}]</citations>`;

function formatDate(d: string | null | undefined) {
  if (!d) return "undated";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function tag(id: string, table: string) {
  return `[id:${id} table:${table}]`;
}

async function buildContext(
  supabase: ReturnType<typeof createClient>,
  subjectId: string,
): Promise<string> {
  const [labs, meds, vitals, symptoms, conditions, family, docs] = await Promise.all([
    supabase
      .from("lab_markers")
      .select("id, name, value, unit, range_low, range_high, collected_at")
      .eq("subject_id", subjectId)
      .order("collected_at", { ascending: false })
      .limit(40),
    supabase
      .from("medications")
      .select("id, name, dose, schedule, type")
      .eq("subject_id", subjectId)
      .eq("active", true),
    supabase
      .from("vitals")
      .select("id, kind, value, secondary, unit, recorded_at")
      .eq("subject_id", subjectId)
      .order("recorded_at", { ascending: false })
      .limit(20),
    supabase
      .from("symptoms")
      .select("id, label, severity, body_area, started_at")
      .eq("subject_id", subjectId)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("conditions")
      .select("id, name, status, diagnosed_at")
      .eq("subject_id", subjectId),
    supabase
      .from("family_history_entries")
      .select("id, relation, conditions")
      .eq("subject_id", subjectId),
    supabase
      .from("source_documents")
      .select("id, title, document_type, document_date, summary")
      .eq("subject_id", subjectId)
      .order("document_date", { ascending: false })
      .limit(20),
  ]);

  const sections: string[] = [];

  if (labs.data?.length) {
    sections.push(
      "LAB RESULTS (most recent first):\n" +
        labs.data
          .map(
            (l) =>
              `- ${l.name}: ${l.value} ${l.unit} (range ${l.range_low ?? "?"}–${l.range_high ?? "?"}) on ${formatDate(l.collected_at)} ${tag(l.id, "lab_markers")}`,
          )
          .join("\n"),
    );
  }
  if (meds.data?.length) {
    sections.push(
      "ACTIVE MEDICATIONS:\n" +
        meds.data
          .map(
            (m) =>
              `- ${m.name}${m.dose ? ` ${m.dose}` : ""}${m.schedule ? `, ${m.schedule}` : ""} (${m.type}) ${tag(m.id, "medications")}`,
          )
          .join("\n"),
    );
  }
  if (vitals.data?.length) {
    sections.push(
      "RECENT VITALS:\n" +
        vitals.data
          .map(
            (v) =>
              `- ${v.kind}: ${v.value}${v.secondary ? `/${v.secondary}` : ""} ${v.unit} on ${formatDate(v.recorded_at)} ${tag(v.id, "vitals")}`,
          )
          .join("\n"),
    );
  }
  if (symptoms.data?.length) {
    sections.push(
      "RECENT SYMPTOMS:\n" +
        symptoms.data
          .map(
            (s) =>
              `- ${s.label} (severity ${s.severity}/10, ${s.body_area ?? "unspecified area"}) started ${formatDate(s.started_at)} ${tag(s.id, "symptoms")}`,
          )
          .join("\n"),
    );
  }
  if (conditions.data?.length) {
    sections.push(
      "CONDITIONS:\n" +
        conditions.data
          .map(
            (c) =>
              `- ${c.name} (${c.status}${c.diagnosed_at ? `, diagnosed ${formatDate(c.diagnosed_at)}` : ""}) ${tag(c.id, "conditions")}`,
          )
          .join("\n"),
    );
  }
  if (family.data?.length) {
    sections.push(
      "FAMILY HISTORY:\n" +
        family.data
          .map(
            (f) =>
              `- ${f.relation}: ${(f.conditions ?? []).join(", ") || "none reported"} ${tag(f.id, "family_history_entries")}`,
          )
          .join("\n"),
    );
  }
  if (docs.data?.length) {
    sections.push(
      "UPLOADED DOCUMENTS:\n" +
        docs.data
          .map(
            (d) =>
              `- "${d.title}" (${d.document_type}, ${formatDate(d.document_date)})${d.summary ? `: ${d.summary}` : " - not yet parsed"} ${tag(d.id, "source_documents")}`,
          )
          .join("\n"),
    );
  }

  return sections.length ? sections.join("\n\n") : "No data logged yet for this person.";
}

type Citation = { title: string; date: string; sourceId?: string; sourceTable?: string };

function parseCitations(raw: string): { content: string; citations: Citation[] } {
  const match = raw.match(/<citations>([\s\S]*?)<\/citations>/);
  if (!match) return { content: raw.trim(), citations: [] };
  const content = raw.slice(0, match.index).trim();
  try {
    const citations = JSON.parse(match[1]);
    return { content, citations: Array.isArray(citations) ? citations : [] };
  } catch {
    return { content, citations: [] };
  }
}

function sseLine(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  let subjectId: string | undefined;
  let content: string | undefined;
  let supabase: ReturnType<typeof createClient> | undefined;
  let callerId: string | undefined;

  try {
    ({ subjectId, content } = await req.json());
    if (!subjectId || !content) return json({ error: "subjectId and content are required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: subject, error: subjectErr } = await supabase
      .from("health_subjects")
      .select("id, name")
      .eq("id", subjectId)
      .single();
    if (subjectErr || !subject) return json({ error: "Subject not found or not accessible" }, 404);

    const { data: userData } = await supabase.auth.getUser();
    callerId = userData.user?.id;
    if (!callerId) return json({ error: "Invalid session" }, 401);

    // Deterministic safety check runs before anything else - no model call,
    // no context assembly, nothing that could delay or dilute it.
    const emergency = checkRedFlag(content);
    if (emergency) {
      const { data: saved, error: saveErr } = await supabase
        .from("chat_messages")
        .insert({
          subject_id: subjectId,
          user_id: callerId,
          role: "assistant",
          content: emergency,
          citations: [],
        })
        .select()
        .single();
      if (saveErr) throw saveErr;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(sseLine({ type: "delta", text: emergency }));
          controller.enqueue(
            sseLine({ type: "done", id: saved.id, citations: [], createdAt: saved.created_at }),
          );
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { ...CORS_HEADERS, "content-type": "application/x-ndjson" },
      });
    }

    // Free-tier quota - enforced server-side, never trust a client-side
    // counter. Checked after the red-flag path (emergency guidance must
    // never be blocked by quota) but before context assembly/the model
    // call, so an exhausted quota doesn't waste that work.
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", callerId)
      .single();
    if (profile?.plan === "free") {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", callerId)
        .eq("role", "user")
        .gte("created_at", monthStart.toISOString());
      const FREE_MONTHLY_LIMIT = 5;
      if ((count ?? 0) > FREE_MONTHLY_LIMIT) {
        const limitMessage = `You've used your ${FREE_MONTHLY_LIMIT} free AI questions for this month. They reset at the start of next month - or upgrade to Pro for unlimited questions with the same grounded citations.`;
        const { data: saved, error: saveErr } = await supabase
          .from("chat_messages")
          .insert({
            subject_id: subjectId,
            user_id: callerId,
            role: "assistant",
            content: limitMessage,
            citations: [],
          })
          .select()
          .single();
        if (saveErr) throw saveErr;
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(sseLine({ type: "delta", text: limitMessage }));
            controller.enqueue(
              sseLine({ type: "done", id: saved.id, citations: [], createdAt: saved.created_at }),
            );
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { ...CORS_HEADERS, "content-type": "application/x-ndjson" },
        });
      }
    }

    // Compliance: log that this subject's health data was read to ground
    // an AI answer - the sensitive-read audit trail the writes-only
    // audit_log couldn't cover on its own (Postgres has no SELECT
    // triggers; this is the one server-side chokepoint for AI reads).
    await supabase.from("audit_log").insert({
      actor_user_id: callerId,
      subject_id: subjectId,
      action: "ai_context_read",
      resource: "health_subjects",
    });

    const [context, recentHistory] = await Promise.all([
      buildContext(supabase, subjectId),
      supabase
        .from("chat_messages")
        .select("role, content")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const history = (recentHistory.data ?? []).reverse();
    const messages = history.length
      ? history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content }))
      : [{ role: "user" as const, content }];

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
    const anthropicStream = anthropic.messages.stream({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\nCONTEXT for ${subject.name}:\n${context}`,
      messages,
    });

    const sbForClose = supabase;
    const subjectIdForClose = subjectId;
    const callerIdForClose = callerId;

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";
        let flushed = 0;
        // Trailing safety margin: hold back the last N chars of streamed
        // text at all times so the "<citations>...</citations>" tag never
        // partially flickers into the visible response as it streams in.
        const HOLDBACK = 24;

        try {
          for await (const event of anthropicStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              fullText += event.delta.text;
              const safeLen = Math.max(0, fullText.length - HOLDBACK);
              if (safeLen > flushed) {
                controller.enqueue(
                  sseLine({ type: "delta", text: fullText.slice(flushed, safeLen) }),
                );
                flushed = safeLen;
              }
            }
          }

          const { content: replyContent, citations } = parseCitations(fullText);
          if (replyContent.length > flushed) {
            controller.enqueue(sseLine({ type: "delta", text: replyContent.slice(flushed) }));
          }

          const { data: saved, error: saveErr } = await sbForClose
            .from("chat_messages")
            .insert({
              subject_id: subjectIdForClose,
              user_id: callerIdForClose,
              role: "assistant",
              content: replyContent,
              citations,
            })
            .select()
            .single();
          if (saveErr) throw saveErr;

          controller.enqueue(
            sseLine({
              type: "done",
              id: saved.id,
              citations: saved.citations,
              createdAt: saved.created_at,
            }),
          );
        } catch (err) {
          console.error(err);
          controller.enqueue(
            sseLine({ type: "error", error: err instanceof Error ? err.message : String(err) }),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...CORS_HEADERS, "content-type": "application/x-ndjson" },
    });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

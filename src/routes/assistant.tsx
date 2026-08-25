/**
 * REPLACE-ME (AI)
 * ----------------------------------------------------------------------
 * This route currently uses useChatHistory()/useSendChatMessage() from
 * @/lib/queries, which round-trip through the mock API and resolve in one
 * shot. To swap in a real streaming AI SDK backend:
 *   1. Add a `/api/chat` TanStack Start server route that proxies to your
 *      LLM provider and streams tokens (e.g. using the Vercel AI SDK's
 *      `streamText` + `toDataStreamResponse`).
 *   2. Replace `useSendChatMessage()` with the AI SDK's `useChat({ api:
 *      "/api/chat" })`, which gives you `messages`, `input`, `handleSubmit`,
 *      and `isLoading` already wired for streaming.
 *   3. Keep rendering citations by having the server route attach them as
 *      message `annotations` or a trailing JSON block the client parses.
 *   4. Remove the optimistic-bubble logic below since `useChat` manages the
 *      message list (including the in-flight assistant message) for you.
 * ----------------------------------------------------------------------
 */
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useChatHistory,
  useSendChatMessage,
  useRecords,
  useLabMarkers,
  useWearables,
  useFamilyHistory,
  useMedications,
} from "@/lib/queries";
import { AsyncBoundary, LoadingRows } from "@/components/data-states";
import { Stagger, StaggerItem, motion } from "@/components/motion";
import type { ChatMessage, Citation } from "@/lib/types";
import { ArrowUp, FileText, Paperclip, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/assistant")({ component: Assistant });

const SUGGESTIONS = [
  "Why did my LDL go up?",
  "Am I sleep deprived?",
  "What should I ask my doctor?",
  "Explain my vitamin D trend",
];

function Assistant() {
  const historyQ = useChatHistory();
  const sendMutation = useSendChatMessage();
  const recordsQ = useRecords();
  const labMarkersQ = useLabMarkers();
  const wearablesQ = useWearables();
  const familyQ = useFamilyHistory();
  const medsQ = useMedications();
  const [input, setInput] = useState("");
  const [optimisticUser, setOptimisticUser] = useState<ChatMessage | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const history = historyQ.data ?? [];
  const displayMessages = optimisticUser ? [...history, optimisticUser] : history;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, sendMutation.isPending, streamingText]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!sendMutation.isPending && optimisticUser) {
      setOptimisticUser(null);
    }
  }, [sendMutation.isPending, optimisticUser]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || sendMutation.isPending) return;
    setOptimisticUser({ id: crypto.randomUUID(), role: "user", content: q });
    setInput("");
    setStreamingText("");
    sendMutation.mutate(
      { content: q, onDelta: (delta) => setStreamingText((prev) => prev + delta) },
      {
        onSettled: () => {
          inputRef.current?.focus();
          setStreamingText("");
        },
      },
    );
  };

  const hasUserMessages = history.some((m) => m.role === "user") || !!optimisticUser;

  return (
    <AppShell
      title="Raag Assistant"
      subtitle="Ask anything about your health. I'll cite the reports I use."
    >
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <Card className="rounded-3xl border-border/60 flex flex-col h-[calc(100vh-14rem)]">
          <CardContent className="p-0 flex flex-col flex-1 min-h-0">
            <div className="rounded-t-3xl bg-warning/10 border-b border-warning/20 px-4 md:px-8 py-2 flex items-center gap-2 text-[11px] text-warning-foreground">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Informational only - not medical
              advice.
            </div>
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
              <AsyncBoundary query={historyQ} skeleton={<LoadingRows count={4} />}>
                {() => (
                  <>
                    {displayMessages.map((m) => (
                      <Message key={m.id} m={m} />
                    ))}
                    {sendMutation.isPending &&
                      (streamingText ? (
                        <Message
                          m={{ id: "streaming", role: "assistant", content: streamingText }}
                        />
                      ) : (
                        <ThinkingBubble />
                      ))}
                  </>
                )}
              </AsyncBoundary>
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border/60 p-4 md:p-6">
              {!hasUserMessages && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs rounded-full bg-muted hover:bg-accent px-3 py-1.5 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your labs, meds, sleep, anything…"
                  className="min-h-[3.5rem] pr-24 rounded-2xl resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full h-8 w-8"
                    aria-label="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => send(input)}
                    disabled={sendMutation.isPending}
                    className="rounded-full h-8 w-8 gradient-primary text-white border-0"
                    aria-label="Send message"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Raag provides informational insights and can make mistakes. Not a substitute for
                medical advice.
              </p>
            </div>
          </CardContent>
        </Card>

        <Stagger className="space-y-4">
          <StaggerItem>
            <Card className="rounded-3xl border-border/60">
              <CardContent className="p-5">
                <div className="text-sm font-semibold mb-3">Grounded in your data</div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" /> {recordsQ.data?.length ?? 0}{" "}
                    medical records
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />{" "}
                    {labMarkersQ.data?.length ?? 0} lab markers tracked
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />{" "}
                    {wearablesQ.data?.filter((w) => w.connected).length ?? 0} connected wearables
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" /> {familyQ.data?.length ?? 0}{" "}
                    family history entries, {medsQ.data?.length ?? 0} medications
                  </li>
                </ul>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="rounded-3xl border-border/60 gradient-hero">
              <CardContent className="p-5">
                <div className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Model
                </div>
                <div className="text-sm font-semibold mt-1">Raag Copilot v4</div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Reasoning tuned for personal health data. Nothing is shared with third parties.
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        </Stagger>
      </div>
    </AppShell>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 shrink-0 rounded-full gradient-primary grid place-items-center text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-2xl bg-muted/60 px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}

function Message({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl gradient-primary text-white px-4 py-3 text-sm shadow-soft">
          {m.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 shrink-0 rounded-full gradient-primary grid place-items-center text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="max-w-[80%] space-y-3">
        <div className="text-sm whitespace-pre-line leading-relaxed">{m.content}</div>
        {m.citations && (
          <div className="flex flex-wrap gap-1.5">
            {m.citations.map((c, i) => (
              <CitationChip key={i} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CitationChip({ c }: { c: Citation }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-[10px] px-2 py-1 rounded-full bg-accent/70 border border-border flex items-center gap-1 hover:bg-accent transition">
          <FileText className="h-3 w-3" /> {c.title} · {c.date}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-2xl">
        <div className="text-sm font-medium">{c.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{c.date}</div>
        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
          This answer is grounded in your own uploaded records - Raag doesn't invent sources.
        </p>
      </PopoverContent>
    </Popover>
  );
}

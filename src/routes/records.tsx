import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AsyncBoundary, EmptyState } from "@/components/data-states";
import { AnimatePresence, Stagger, StaggerItem, motion } from "@/components/motion";
import { useDeleteRecord, useUploadRecord, recordsQuery } from "@/lib/queries";
import type { MedicalRecord } from "@/lib/types";
import { Download, Eye, FileText, LayoutGrid, List, Search, Trash2, Upload, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const PARSING_STATUSES = new Set(["pending", "processing"]);

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "Medical Records — Orvana" },
      { name: "description", content: "Every PDF, scan, and prescription — searchable and yours." },
      { property: "og:title", content: "Medical Records — Orvana" },
      { property: "og:description", content: "Every PDF, scan, and prescription — searchable and yours." },
    ],
  }),
  component: Records,
});

// Signed Storage URLs are cross-origin, so a plain <a download> is ignored
// by most browsers — fetch the bytes and save via an object URL instead.
async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function ParseStatusBadge({ status }: { status?: MedicalRecord["parseStatus"] }) {
  if (status === "pending" || status === "processing") {
    return (
      <Badge variant="outline" className="rounded-full text-[10px] gap-1 border-primary/40 text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Reading document…
      </Badge>
    );
  }
  if (status === "failed") {
    return <Badge variant="outline" className="rounded-full text-[10px] border-destructive/40 text-destructive">Parsing failed</Badge>;
  }
  return null;
}

function Records() {
  // Same query key/cache as everywhere else, but polls while any record is
  // still being parsed — otherwise you'd have no way to know parse-record
  // finished short of manually reloading the page.
  const recordsQ = useQuery({
    ...recordsQuery,
    refetchInterval: (query) => (query.state.data?.some((r) => PARSING_STATUSES.has(r.parseStatus ?? "")) ? 4000 : false),
  });
  const upload = useUploadRecord();
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      setPendingFiles((p) => [...p, file.name]);
      upload.mutate(file, { onSettled: () => setPendingFiles((p) => p.filter((n) => n !== file.name)) });
    });
  };

  return (
    <AppShell
      title="Medical Records"
      subtitle="Every PDF, scan, and prescription — searchable and yours."
      actions={
        <Button className="rounded-full gradient-primary text-white border-0" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Upload
        </Button>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`mb-6 rounded-3xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10"
        }`}
      >
        <UploadCloud className={`mx-auto h-8 w-8 ${dragActive ? "text-primary" : "text-muted-foreground"}`} />
        <p className="mt-2 text-sm font-medium">Drag & drop files here</p>
        <p className="text-xs text-muted-foreground">or</p>
        <Button variant="outline" className="rounded-full mt-2" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
      </div>

      <AnimatePresence>
        {pendingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 space-y-2 overflow-hidden"
          >
            {pendingFiles.map((name) => (
              <div key={name} className="rounded-2xl border border-border/60 p-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="truncate">{name}</span>
                  <span className="text-muted-foreground">Uploading…</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden relative">
                  <motion.div
                    className="absolute inset-y-0 w-1/3 rounded-full bg-primary/70"
                    animate={{ left: ["-33%", "100%"] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AsyncBoundary
        query={recordsQ}
        empty={<EmptyState icon={FileText} title="No records yet" body="Upload a file to get started." />}
      >
        {(records) => (
          <RecordsBody records={records} q={q} setQ={setQ} activeTag={activeTag} setActiveTag={setActiveTag} view={view} setView={setView} />
        )}
      </AsyncBoundary>
    </AppShell>
  );
}

function RecordsBody({
  records,
  q,
  setQ,
  activeTag,
  setActiveTag,
  view,
  setView,
}: {
  records: MedicalRecord[];
  q: string;
  setQ: (v: string) => void;
  activeTag: string | null;
  setActiveTag: (v: string | null) => void;
  view: "list" | "grid";
  setView: (v: "list" | "grid") => void;
}) {
  const del = useDeleteRecord();
  const tags = useMemo(() => Array.from(new Set(records.map((r) => r.tag))), [records]);
  const filtered = records.filter((r) => {
    const matchesQ = (r.title + r.provider + r.tag).toLowerCase().includes(q.toLowerCase());
    const matchesTag = !activeTag || r.tag === activeTag;
    return matchesQ && matchesTag;
  });

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search records, providers, tags…" className="pl-10 rounded-full h-11" />
          </div>
          <div className="flex rounded-full border border-border/60 p-1">
            <Button
              size="icon"
              variant={view === "list" ? "secondary" : "ghost"}
              className="rounded-full h-9 w-9"
              aria-label="List view"
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={view === "grid" ? "secondary" : "ghost"}
              className="rounded-full h-9 w-9"
              aria-label="Grid view"
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <Badge
            onClick={() => setActiveTag(null)}
            variant={activeTag === null ? "default" : "secondary"}
            className="rounded-full cursor-pointer text-[10px]"
          >
            All
          </Badge>
          {tags.map((t) => (
            <Badge
              key={t}
              onClick={() => setActiveTag(t)}
              variant={activeTag === t ? "default" : "secondary"}
              className="rounded-full cursor-pointer text-[10px]"
            >
              {t}
            </Badge>
          ))}
        </div>

        <Card className="rounded-3xl border-border/60">
          <CardContent className="p-3">
            <div className="text-xs uppercase text-muted-foreground tracking-wider px-3 py-2">Timeline</div>
            <AnimatePresence>
              <Stagger className={view === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-1"}>
                {filtered.map((r) => (
                  <StaggerItem key={r.id}>
                    <motion.div layout exit={{ opacity: 0, scale: 0.96 }} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl px-3 py-3 hover:bg-accent/50 transition">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm truncate">{r.title}</div>
                          <Badge variant="secondary" className="rounded-full text-[10px]">{r.tag}</Badge>
                          <ParseStatusBadge status={r.parseStatus} />
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{r.provider} · {r.type}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground hidden sm:block">{r.date}</div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="rounded-full h-8 w-8" aria-label="Record actions">
                              <span className="sr-only">Open menu</span>
                              <MoreDots />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled={!r.fileUrl} onClick={() => r.fileUrl && window.open(r.fileUrl, "_blank", "noopener,noreferrer")}>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!r.fileUrl} onClick={() => r.fileUrl && downloadFile(r.fileUrl, r.title)}>
                              <Download className="mr-2 h-4 w-4" /> Download
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this record?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove "{r.title}" from your records.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => del.mutate(r.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  </StaggerItem>
                ))}
              </Stagger>
            </AnimatePresence>
            {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No records match.</div>}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="rounded-3xl border-border/60">
          <CardContent className="p-5">
            <div className="text-sm font-semibold mb-3">By tag</div>
            {tags.map((t) => (
              <div key={t} className="flex items-center justify-between text-sm py-1.5">
                <span className="text-muted-foreground">{t}</span>
                <span className="font-medium">{records.filter((r) => r.tag === t).length}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/60 gradient-hero">
          <CardContent className="p-5">
            <div className="text-sm font-semibold">Auto-parsing on</div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              New uploads are OCR'd, tagged, and made searchable within seconds.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MoreDots() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" className="text-muted-foreground">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

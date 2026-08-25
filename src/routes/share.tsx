import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AsyncBoundary, EmptyState, LoadingCards } from "@/components/data-states";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useShareLinks, useCreateShareLink, useRevokeShareLink } from "@/lib/queries";
import type { ShareLink, ShareScope } from "@/lib/types";
import { Ban, Check, Copy, Link2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/share")({
  component: SharePage,
  head: () => ({
    meta: [
      { title: "Share Links - Raag" },
      {
        name: "description",
        content: "Give a doctor or family member a scoped, expiring view of your records.",
      },
    ],
  }),
});

const SCOPE_LABEL: Record<ShareScope, string> = {
  summary: "Summary",
  labs: "Summary + Labs",
  medications: "Summary + Medications",
  full: "Full record",
};

function linkStatus(link: ShareLink): { label: string; tone: string } {
  if (link.revokedAt) return { label: "Revoked", tone: "bg-muted text-muted-foreground" };
  if (new Date(link.expiresAt).getTime() < Date.now())
    return { label: "Expired", tone: "bg-muted text-muted-foreground" };
  return { label: "Active", tone: "bg-success/15 text-success-foreground border-success/30" };
}

function SharePage() {
  const linksQ = useShareLinks();

  return (
    <AppShell
      title="Share Links"
      subtitle="Hand a doctor or family member a scoped, expiring view - no account needed on their end."
      actions={<CreateLinkDialog />}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <p>
            Links never include your uploaded documents/files - only structured data (labs,
            medications, vitals) within the scope you pick. Revoke a link any time; every view is
            logged.
          </p>
        </div>

        <AsyncBoundary
          query={linksQ}
          skeleton={<LoadingCards count={3} />}
          empty={
            <EmptyState
              title="No share links yet"
              body="Create one to give a doctor or family member read-only access."
            />
          }
        >
          {(links) => (
            <Stagger className="grid gap-3">
              {links.map((link) => (
                <StaggerItem key={link.id}>
                  <LinkCard link={link} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </AsyncBoundary>
      </div>
    </AppShell>
  );
}

function LinkCard({ link }: { link: ShareLink }) {
  const revoke = useRevokeShareLink();
  const [copied, setCopied] = useState(false);
  const status = linkStatus(link);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${link.token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy - copy the URL manually");
    }
  }

  return (
    <Card className="rounded-3xl border-border/60">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                {link.label || SCOPE_LABEL[link.scope]}
              </div>
              <Badge variant="outline" className={`rounded-full text-[10px] ${status.tone}`}>
                {status.label}
              </Badge>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {SCOPE_LABEL[link.scope]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-md">{url}</p>
            <p className="text-xs text-muted-foreground">
              Expires {new Date(link.expiresAt).toLocaleDateString()} · Viewed {link.accessCount}{" "}
              time{link.accessCount === 1 ? "" : "s"}
              {link.lastAccessedAt
                ? ` · last on ${new Date(link.lastAccessedAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={copyLink}
              disabled={status.label !== "Active"}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1.5">{copied ? "Copied" : "Copy link"}</span>
            </Button>
            {status.label === "Active" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-destructive hover:text-destructive"
                  >
                    <Ban className="h-3.5 w-3.5 mr-1.5" /> Revoke
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke this link?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Anyone with this URL will immediately lose access. This can't be undone -
                      you'd need to create a new link.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => revoke.mutate(link.id)}>
                      Revoke
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateLinkDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<ShareScope>("summary");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const createLink = useCreateShareLink();

  function submit() {
    createLink.mutate(
      { label: label.trim() || undefined, scope, expiresInDays: Number(expiresInDays) || 7 },
      {
        onSuccess: () => {
          setOpen(false);
          setLabel("");
          setScope("summary");
          setExpiresInDays("7");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary text-white border-0">
          <Plus className="mr-1.5 h-4 w-4" /> New link
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a share link</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Label (optional)</Label>
            <Input
              placeholder="For Dr. Mehta"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">What to share</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as ShareScope)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">
                  Summary - conditions, current meds, latest vitals
                </SelectItem>
                <SelectItem value="labs">Summary + Labs</SelectItem>
                <SelectItem value="medications">Summary + Medications (with adherence)</SelectItem>
                <SelectItem value="full">Full record - + symptoms, family history</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Expires in</Label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={createLink.isPending}
            className="rounded-full gradient-primary text-white border-0"
          >
            Create link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

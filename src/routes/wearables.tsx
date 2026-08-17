import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AsyncBoundary, EmptyState } from "@/components/data-states";
import { Stagger, StaggerItem, motion } from "@/components/motion";
import { useToggleWearable, useWearables } from "@/lib/queries";
import type { WearableConnection } from "@/lib/types";
import { Loader2, Watch } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/wearables")({
  head: () => ({
    meta: [
      { title: "Wearables & Devices — Atlas Health" },
      { name: "description", content: "One dashboard for every ecosystem." },
      { property: "og:title", content: "Wearables & Devices — Atlas Health" },
      { property: "og:description", content: "One dashboard for every ecosystem." },
    ],
  }),
  component: Wearables,
});

function Wearables() {
  const wearablesQuery = useWearables();
  return (
    <AppShell title="Wearables & Devices" subtitle="One dashboard for every ecosystem.">
      <AsyncBoundary
        query={wearablesQuery}
        empty={<EmptyState icon={Watch} title="No devices found" body="Connect a wearable to see your data here." />}
      >
        {(wearables) => <WearablesBody wearables={wearables} />}
      </AsyncBoundary>
    </AppShell>
  );
}

function WearablesBody({ wearables }: { wearables: WearableConnection[] }) {
  const toggle = useToggleWearable();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const connectedCount = wearables.filter((w) => w.connected).length;

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Connected devices</div>
            <div className="text-xs text-muted-foreground">Sync status across your ecosystem</div>
          </div>
          <div className="font-display text-2xl">
            {connectedCount} <span className="text-sm text-muted-foreground">of {wearables.length}</span>
          </div>
        </CardContent>
      </Card>

      <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wearables.map((w) => {
          const isPending = toggle.isPending && pendingName === w.name;
          return (
            <StaggerItem key={w.name}>
              <Card className="rounded-3xl border-border/60 overflow-hidden">
                <div className={`h-24 bg-gradient-to-br ${w.color} relative`}>
                  <div className="absolute inset-0 grid place-items-center text-white/95">
                    <Watch className="h-8 w-8" />
                  </div>
                  {w.connected && (
                    <span className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-white/25 text-white backdrop-blur">
                      <span className="relative flex h-2 w-2">
                        <motion.span
                          className="absolute inline-flex h-full w-full rounded-full bg-white/80"
                          animate={{ scale: [1, 1.8], opacity: [0.8, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                        />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      Live
                    </span>
                  )}
                </div>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{w.desc}</div>
                    </div>
                    <Badge className={`rounded-full text-[10px] ${w.connected ? "bg-success/20 text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                      {w.connected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Last sync · {w.last}</div>
                    <Button
                      size="sm"
                      variant={w.connected ? "outline" : "default"}
                      className={`rounded-full ${w.connected ? "" : "gradient-primary text-white border-0"}`}
                      disabled={isPending}
                      onClick={() => {
                        setPendingName(w.name);
                        toggle.mutate(
                          { name: w.name, connect: !w.connected },
                          { onSettled: () => setPendingName(null) },
                        );
                      }}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : w.connected ? "Manage" : "Connect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}

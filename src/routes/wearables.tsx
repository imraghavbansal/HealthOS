import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AsyncBoundary, EmptyState } from "@/components/data-states";
import { Stagger, StaggerItem } from "@/components/motion";
import { useWearables } from "@/lib/queries";
import type { WearableConnection } from "@/lib/types";
import { Watch } from "lucide-react";

export const Route = createFileRoute("/wearables")({
  head: () => ({
    meta: [
      { title: "Wearables & Devices — Raag" },
      { name: "description", content: "One dashboard for every ecosystem." },
      { property: "og:title", content: "Wearables & Devices — Raag" },
      { property: "og:description", content: "One dashboard for every ecosystem." },
    ],
  }),
  component: Wearables,
});

function Wearables() {
  const wearablesQuery = useWearables();
  return (
    <AppShell title="Wearables & Devices" subtitle="One dashboard for every ecosystem.">
      <div className="mb-5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-xs text-warning-foreground">
        Wearable sync isn't live yet — connecting a provider here doesn't pull in real data until a
        wearable aggregator account (Vital or Terra) is set up. The schema and sync pipeline are
        already built and ready; this is genuinely "coming soon," not a working feature in disguise.
      </div>
      <AsyncBoundary
        query={wearablesQuery}
        empty={
          <EmptyState
            icon={Watch}
            title="No devices found"
            body="Connect a wearable to see your data here."
          />
        }
      >
        {(wearables) => <WearablesBody wearables={wearables} />}
      </AsyncBoundary>
    </AppShell>
  );
}

function WearablesBody({ wearables }: { wearables: WearableConnection[] }) {
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
            {connectedCount}{" "}
            <span className="text-sm text-muted-foreground">of {wearables.length}</span>
          </div>
        </CardContent>
      </Card>

      <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wearables.map((w) => {
          return (
            <StaggerItem key={w.name}>
              <Card className="rounded-3xl border-border/60 overflow-hidden opacity-70">
                <div className={`h-24 bg-gradient-to-br ${w.color} relative`}>
                  <div className="absolute inset-0 grid place-items-center text-white/95">
                    <Watch className="h-8 w-8" />
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{w.desc}</div>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      Coming soon
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Needs a wearable aggregator account
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full" disabled>
                      Connect
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

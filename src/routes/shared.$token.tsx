import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, AlertTriangle, Pill, Activity, FlaskConical, Users2 } from "lucide-react";
import { fetchSharedRecord } from "@/lib/share";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/shared/$token")({
  component: SharedRecordPage,
  head: () => ({
    meta: [
      { title: "Shared Health Record - Raag" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function SharedRecordPage() {
  const { token } = Route.useParams();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["shared-record", token],
    queryFn: () => fetchSharedRecord(token),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 gradient-glow pointer-events-none opacity-70" />
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="flex items-center gap-2 mb-8 w-fit">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-soft">
            <Heart className="h-4.5 w-4.5 text-white" fill="white" />
          </div>
          <span className="font-semibold">Raag</span>
          <Badge variant="outline" className="ml-2 rounded-full text-[10px]">
            Shared, read-only
          </Badge>
        </div>

        {isPending && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
          </div>
        )}

        {isError && (
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h1 className="font-display text-xl">Can't open this link</h1>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Something went wrong."}
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-3xl">{data.subjectName}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {[data.age !== null ? `${data.age} years` : null, data.sex, data.bloodType]
                  .filter(Boolean)
                  .join(" · ") || "No profile details on file"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Generated {new Date(data.generatedAt).toLocaleString()} · This is informational, not
                medical advice.
              </p>
            </div>

            <Section icon={AlertTriangle} title="Active conditions">
              {data.activeConditions.length === 0 ? (
                <p className="text-sm text-muted-foreground">None on file.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.activeConditions.map((c, i) => (
                    <li key={i} className="text-sm flex items-center justify-between">
                      <span>{c.name}</span>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {c.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={Pill} title="Current medications">
              {data.currentMedications.length === 0 ? (
                <p className="text-sm text-muted-foreground">None on file.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.currentMedications.map((m) => (
                    <li key={m.id} className="text-sm">
                      <span className="font-medium">{m.name}</span>
                      {m.dose ? <span className="text-muted-foreground"> - {m.dose}</span> : null}
                      {m.schedule ? (
                        <span className="text-muted-foreground"> · {m.schedule}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={Activity} title="Latest vitals">
              {data.latestVitals.length === 0 ? (
                <p className="text-sm text-muted-foreground">None logged.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.latestVitals.map((v, i) => (
                    <div key={i} className="rounded-xl border border-border/60 p-3">
                      <div className="text-xs text-muted-foreground capitalize">
                        {v.kind.replace(/([A-Z])/g, " $1")}
                      </div>
                      <div className="text-sm font-semibold mt-0.5">
                        {v.value}
                        {v.secondary ? `/${v.secondary}` : ""} {v.unit}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(v.recorded_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {data.labMarkers && (
              <Section icon={FlaskConical} title="Lab results">
                {data.labMarkers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None on file.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.labMarkers.map((l, i) => {
                      const outOfRange =
                        (l.range_low != null && l.value < l.range_low) ||
                        (l.range_high != null && l.value > l.range_high);
                      return (
                        <div key={i} className="text-sm flex items-center justify-between">
                          <span>{l.name}</span>
                          <span className={outOfRange ? "text-destructive font-medium" : ""}>
                            {l.value} {l.unit}
                            {l.range_low != null && l.range_high != null ? (
                              <span className="text-muted-foreground text-xs">
                                {" "}
                                ({l.range_low}–{l.range_high})
                              </span>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            )}

            {data.familyHistory && (
              <Section icon={Users2} title="Family history">
                {data.familyHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None on file.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.familyHistory.map((f, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{f.relation}</span>
                        {f.age ? (
                          <span className="text-muted-foreground"> · age {f.age}</span>
                        ) : null}
                        {f.conditions && f.conditions.length > 0 ? (
                          <span className="text-muted-foreground">
                            {" "}
                            - {f.conditions.join(", ")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Heart;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-border/60">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

/** Card-shaped skeletons for grids/lists while data loads. */
export function LoadingCards({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={className || "grid gap-4 md:grid-cols-2 lg:grid-cols-3"}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-3xl border-border/60">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function LoadingChart({ height = 240 }: { height?: number }) {
  return <Skeleton className="w-full rounded-2xl" style={{ height }} />;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-dashed border-border/70 bg-muted/20">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-medium">{title}</div>
          {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Card className="rounded-3xl border-destructive/40 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <div>
          <div className="font-medium">We couldn't load this</div>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {message ?? "The request failed. Check your connection and try again."}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" className="rounded-full" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Standard async wrapper: handles loading, error and empty in one place. */
export function AsyncBoundary<T>({
  query,
  skeleton,
  empty,
  children,
}: {
  query: { data?: T; isPending: boolean; isError: boolean; error?: unknown; refetch: () => void };
  skeleton?: ReactNode;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton ?? <LoadingCards />}</>;
  if (query.isError)
    return <ErrorState message={(query.error as Error | undefined)?.message} onRetry={() => query.refetch()} />;
  const data = query.data as T;
  if (empty && Array.isArray(data) && data.length === 0) return <>{empty}</>;
  return <>{children(data)}</>;
}

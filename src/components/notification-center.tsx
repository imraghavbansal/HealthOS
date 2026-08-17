import { AnimatePresence, motion } from "motion/react";
import { Bell, BellOff, CalendarClock, CheckCheck, FlaskConical, Info, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/lib/queries";
import { Link } from "@tanstack/react-router";
import type { AppNotification } from "@/lib/types";

const KIND_ICON = {
  reminder: CalendarClock,
  result: FlaskConical,
  insight: Info,
  system: Settings2,
} as const;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Number.isNaN(mins)) return "";
  if (Math.abs(mins) < 60) return `${Math.max(1, Math.abs(mins))}m ago`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return `${Math.abs(hrs)}h ago`;
  return `${Math.abs(Math.round(hrs / 24))}d ago`;
}

export function NotificationCenter() {
  const { data, isPending } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items: AppNotification[] = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative rounded-full">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground"
            >
              {unread}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] rounded-2xl p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-[340px]">
          {isPending ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <BellOff className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">You're all caught up.</p>
            </div>
          ) : (
            <div className="p-2">
              <AnimatePresence initial={false}>
                {items.map((n) => {
                  const Icon = KIND_ICON[n.kind];
                  return (
                    <motion.button
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => !n.read && markRead.mutate(n.id)}
                      className={`flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-accent/50 ${n.read ? "opacity-60" : ""}`}
                    >
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{n.title}</span>
                          {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
        <Separator />
        <Link to="/settings" className="block px-4 py-2.5 text-center text-xs text-muted-foreground hover:text-foreground">
          Notification settings
        </Link>
      </PopoverContent>
    </Popover>
  );
}

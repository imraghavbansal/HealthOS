import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Apple,
  CalendarDays,
  Command,
  FileBarChart,
  Heart,
  HeartPulse,
  History,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Pill,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  Sun,
  Target,
  Users,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { CommandPalette } from "@/components/command-palette";
import { NotificationCenter } from "@/components/notification-center";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IS_DEMO } from "@/lib/api";
import { useProfile } from "@/lib/queries";
import { signOut, hasActiveSession } from "@/lib/auth";
import { LogOut, Settings as SettingsIcon, User } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, type ReactNode } from "react";

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { heading: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/assistant", label: "AI Assistant", icon: MessageSquare },
      { to: "/timeline", label: "Timeline", icon: History },
    ],
  },
  {
    heading: "Clinical",
    items: [
      { to: "/records", label: "Medical Records", icon: HeartPulse },
      { to: "/labs", label: "Lab Results", icon: Activity },
      { to: "/vitals", label: "Vitals", icon: Stethoscope },
      { to: "/medications", label: "Medications", icon: Pill },
      { to: "/appointments", label: "Appointments", icon: CalendarDays },
    ],
  },
  {
    heading: "Lifestyle",
    items: [
      { to: "/wearables", label: "Wearables", icon: Watch },
      { to: "/nutrition", label: "Nutrition", icon: Apple },
      { to: "/symptoms", label: "Symptoms", icon: HeartPulse },
      { to: "/goals", label: "Goals", icon: Target },
    ],
  },
  {
    heading: "Insight & account",
    items: [
      { to: "/family", label: "Family & Risk", icon: Users },
      { to: "/reports", label: "Reports", icon: FileBarChart },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const { data: profile } = useProfile();
  const nav = useNavigate();

  // Every authenticated screen renders through AppShell, so this is the one
  // place a signed-out visitor gets redirected instead of every page
  // individually throwing on RLS-empty data. Mock mode has no real
  // sessions, so it's exempt — the demo stays browsable without signing in.
  const [checkingSession, setCheckingSession] = useState(!IS_DEMO);
  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    hasActiveSession().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        nav({ to: "/login" });
      } else {
        setCheckingSession(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [nav]);

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    nav({ to: "/" });
  }

  if (checkingSession) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Checking your session…</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="gradient-glow pointer-events-none fixed inset-0 -z-10 opacity-70" />
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-border/60 bg-sidebar/70 backdrop-blur-xl lg:flex">
          <Link to="/" className="flex items-center gap-2 px-6 pt-6 pb-6">
            <div className="gradient-primary grid h-9 w-9 place-items-center rounded-xl shadow-soft">
              <Heart className="h-4.5 w-4.5 text-white" fill="white" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Raag</div>
              <div className="text-[10px] tracking-widest text-muted-foreground uppercase">Personal OS</div>
            </div>
          </Link>

          <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-2 no-scrollbar">
            {NAV_GROUPS.map((group) => (
              <div key={group.heading}>
                <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  {group.heading}
                </div>
                <div className="space-y-0.5">
                  {group.items.map(({ to, label, icon: Icon }) => {
                    const active = pathname === to || pathname.startsWith(`${to}/`);
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                          active
                            ? "text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-active"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                            className="absolute inset-0 rounded-xl bg-sidebar-accent shadow-soft"
                          />
                        )}
                        <Icon className={`relative z-10 h-4 w-4 ${active ? "text-primary" : ""}`} />
                        <span className="relative z-10 font-medium">{label}</span>
                        {active && <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="glass m-3 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> AI Copilot
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Insights are informational and not a substitute for medical advice.
            </p>
            {IS_DEMO && (
              <Badge className="mt-3 rounded-full bg-warning/20 text-[10px] text-warning-foreground">Demo data</Badge>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
            <div className="flex items-center gap-4 px-4 py-4 md:px-8">
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-2xl md:text-3xl">{title}</h1>
                {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
                  className="hidden items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted md:flex"
                  aria-label="Open command palette"
                >
                  <Search className="h-3.5 w-3.5" /> Search or ask…
                  <kbd className="ml-6 flex items-center gap-0.5 rounded border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
                    <Command className="h-2.5 w-2.5" />K
                  </kbd>
                </button>
                {actions}
                <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="rounded-full">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={theme}
                      initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.2 }}
                      className="grid place-items-center"
                    >
                      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </motion.span>
                  </AnimatePresence>
                </Button>
                <NotificationCenter />
                {profile ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Account menu" className="rounded-full">
                        <Avatar className="h-9 w-9 ring-2 ring-border transition hover:ring-primary/40">
                          <AvatarFallback className="gradient-primary text-xs font-semibold text-white">
                            {profile.initials}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="text-sm font-medium truncate">{profile.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{profile.email}</div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/settings">
                          <User className="mr-2 h-4 w-4" /> Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/settings">
                          <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" /> Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Skeleton className="h-9 w-9 rounded-full" />
                )}
              </div>
            </div>

            {/* Mobile nav */}
            <nav className="flex gap-1 overflow-x-auto px-4 pb-3 no-scrollbar lg:hidden">
              {FLAT_NAV.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                      active ? "gradient-primary text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main id="main-content" className="px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

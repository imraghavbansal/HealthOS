import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Apple,
  CalendarDays,
  FileBarChart,
  HeartPulse,
  History,
  LayoutDashboard,
  MessageSquare,
  Pill,
  Settings,
  Sparkles,
  Stethoscope,
  Target,
  Users,
  Watch,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "Ask Raag AI", icon: MessageSquare },
  { to: "/timeline", label: "Health Timeline", icon: History },
  { to: "/records", label: "Medical Records", icon: HeartPulse },
  { to: "/labs", label: "Lab Results", icon: Activity },
  { to: "/vitals", label: "Vitals & Biometrics", icon: Stethoscope },
  { to: "/medications", label: "Medications", icon: Pill },
  { to: "/appointments", label: "Appointments & Care", icon: CalendarDays },
  { to: "/wearables", label: "Wearables", icon: Watch },
  { to: "/nutrition", label: "Nutrition & Hydration", icon: Apple },
  { to: "/symptoms", label: "Symptom Journal", icon: HeartPulse },
  { to: "/goals", label: "Health Goals", icon: Target },
  { to: "/family", label: "Family & Risk", icon: Users },
  { to: "/reports", label: "Reports & Export", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

const AI_PROMPTS = [
  "Why did my LDL go up?",
  "Am I sleep deprived?",
  "Explain my vitamin D trend",
  "What should I ask my doctor?",
  "How's my recovery this month?",
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or ask Raag anything…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {ITEMS.map((i) => (
            <CommandItem key={i.to} value={i.label} onSelect={() => go(i.to)}>
              <i.icon className="mr-2 h-4 w-4" />
              {i.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ask Raag">
          {AI_PROMPTS.map((p) => (
            <CommandItem key={p} value={p} onSelect={() => go("/assistant")}>
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              {p}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

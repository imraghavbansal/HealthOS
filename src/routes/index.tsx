import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Brain,
  FileText,
  Heart,
  HeartPulse,
  Lock,
  MessageSquare,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Watch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { Lift, Reveal, Stagger, StaggerItem, motion } from "@/components/motion";
import { useRedirectIfAuthenticated } from "@/lib/use-redirect-if-authenticated";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { theme, toggle } = useTheme();
  // Doesn't block rendering on this - the marketing page should paint
  // immediately for anonymous visitors (SEO, first impression); a
  // signed-in user gets redirected to /dashboard a moment later instead
  // of blocking every visitor behind a loading screen for one.
  useRedirectIfAuthenticated();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <div className="fixed inset-0 -z-10 gradient-glow pointer-events-none" />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.08, rotate: -4 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-soft"
            >
              <Heart className="h-4.5 w-4.5 text-white" fill="white" />
            </motion.div>
            <span className="font-semibold tracking-tight">Raag</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            {[
              { href: "#features", label: "Features" },
              { href: "#how", label: "How it works" },
              { href: "#privacy", label: "Privacy" },
              { href: "#pricing", label: "Pricing" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group relative py-1 hover:text-foreground transition"
              >
                {item.label}
                <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 gradient-primary transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="text-xs px-3 py-1.5 rounded-full border border-border/60 transition hover:border-primary/50 hover:text-primary active:scale-95"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <Link
              to="/login"
              className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition"
            >
              Sign in
            </Link>
            <Link to="/signup">
              <Button className="rounded-full gradient-primary text-white shadow-soft border-0 transition-transform hover:scale-105 active:scale-95">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-x-0 top-0 h-[560px] texture-dots opacity-[0.05] pointer-events-none [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
        <div className="max-w-7xl mx-auto px-6 pt-16 md:pt-28 pb-20 md:pb-32 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-primary mb-8 transition-shadow hover:shadow-soft">
              <Sparkles className="h-3.5 w-3.5" /> Introducing Raag Copilot · Grounded in your
              records
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] max-w-5xl mx-auto">
              Your entire health, <span className="text-gradient italic">understood.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Raag unifies your labs, wearables, records, and family history into one calm,
              AI-guided view - so you understand what's changing, and what to do about it.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="group rounded-full gradient-primary text-white shadow-soft border-0 h-12 px-6 transition-all hover:scale-[1.03] active:scale-95"
                >
                  Start free - 60 seconds{" "}
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="#features">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full h-12 px-6 border-border/60 transition-all hover:border-primary/50 hover:-translate-y-0.5"
                >
                  See how it works
                </Button>
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <a
                href="#privacy"
                className="underline decoration-dotted underline-offset-2 hover:text-foreground transition"
              >
                Encrypted · Isolated per user · Never sold
              </a>
            </div>
          </Reveal>

          {/* Hero mock */}
          <Reveal delay={0.4}>
            <div className="mt-16 md:mt-20 relative">
              <div className="absolute -inset-6 md:-inset-12 gradient-mint opacity-40 blur-3xl rounded-[3rem]" />
              <Lift className="relative mx-auto max-w-5xl">
                <div className="rounded-3xl glass p-4 md:p-6 animate-float">
                  <div className="grid md:grid-cols-3 gap-4">
                    <MockCard
                      tone="primary"
                      label="Health Score"
                      value="87"
                      trend="+3 this week"
                      icon={HeartPulse}
                    />
                    <MockCard
                      tone="teal"
                      label="Sleep"
                      value="7h 48m"
                      trend="Deep 1.7h · REM 1.9h"
                      icon={Activity}
                    />
                    <MockCard
                      tone="mint"
                      label="Recovery"
                      value="Excellent"
                      trend="HRV 68ms · +12%"
                      icon={TrendingUp}
                    />
                    <div className="md:col-span-2 rounded-2xl bg-card/80 border border-border/60 p-5 text-left transition-colors hover:border-primary/40">
                      <div className="flex items-center gap-2 text-xs font-medium text-primary mb-2">
                        <Sparkles className="h-3.5 w-3.5" /> Raag · Today's insight
                      </div>
                      <p className="text-sm leading-relaxed">
                        Your LDL nudged up 4 points since August. That aligns with a lighter cardio
                        week and higher saturated fat during travel.{" "}
                        <span className="text-primary underline underline-offset-2 cursor-pointer">
                          See the 3 records I used
                        </span>
                        .
                      </p>
                    </div>
                    <div className="rounded-2xl bg-card/80 border border-border/60 p-5 text-left transition-colors hover:border-primary/40">
                      <div className="text-xs text-muted-foreground mb-2">Next up</div>
                      <div className="text-sm font-medium">Vitamin D3 · 5000 IU</div>
                      <div className="text-xs text-muted-foreground mt-1">Tomorrow · 8:00 AM</div>
                    </div>
                  </div>
                </div>
              </Lift>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-medium text-primary uppercase tracking-widest">
              One place, everything
            </div>
            <h2 className="font-display text-4xl md:text-5xl mt-3">
              One health record that actually remembers you.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Built for the way people actually manage health - messy PDFs, five apps, family
              history you half-remember.
            </p>
          </div>
        </Reveal>
        <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <Lift className="group h-full rounded-3xl glass p-6 transition-colors hover:border-primary/40 cursor-default">
                <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-primary text-white shadow-soft transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-semibold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </Lift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* How */}
      <section id="how" className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div>
              <div className="text-xs font-medium text-primary uppercase tracking-widest">
                How it works
              </div>
              <h2 className="font-display text-4xl md:text-5xl mt-3">
                Three steps to a clearer picture.
              </h2>
              <Stagger className="mt-10 space-y-6">
                {STEPS.map((s, i) => (
                  <StaggerItem key={s.title} className="group flex gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full gradient-primary text-white text-sm font-semibold shadow-soft transition-transform duration-300 group-hover:scale-110">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold">{s.title}</div>
                      <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <Lift className="rounded-3xl glass p-6 md:p-8">
              <div className="rounded-2xl gradient-hero p-6">
                <div className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Ask Raag
                </div>
                <Reveal delay={0.1}>
                  <div className="mt-4 text-sm bg-card/80 rounded-2xl p-4 border border-border/60">
                    <span className="font-medium">You:</span> Why did my LDL go up this year?
                  </div>
                </Reveal>
                <Reveal delay={0.3}>
                  <div className="mt-3 text-sm bg-card rounded-2xl p-4 border border-border/60 shadow-soft">
                    <span className="font-medium text-primary">Raag:</span> Your LDL rose from 108 →
                    118 mg/dL since Jan. Two signals from your data align: cardio dropped 32% in Q3,
                    and saturated fat climbed during your July travel. Genetics likely contribute -
                    noted from your paternal CAD history.
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/60 border border-border transition-colors hover:border-primary/50 hover:bg-primary/10 cursor-default">
                        Lipid Panel · Aug 15
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/60 border border-border transition-colors hover:border-primary/50 hover:bg-primary/10 cursor-default">
                        CBC · Nov 12
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/60 border border-border transition-colors hover:border-primary/50 hover:bg-primary/10 cursor-default">
                        Family History
                      </span>
                    </div>
                  </div>
                </Reveal>
              </div>
            </Lift>
          </Reveal>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <Reveal>
          <Lift className="rounded-3xl glass p-8 md:p-14 text-center">
            <motion.div
              whileHover={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 0.5 }}
              className="grid h-14 w-14 mx-auto place-items-center rounded-2xl gradient-primary text-white shadow-soft"
            >
              <Shield className="h-6 w-6" />
            </motion.div>
            <h2 className="font-display text-4xl md:text-5xl mt-6">
              Your data is yours. Full stop.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Encrypted at rest and in transit. Every record is isolated to you at the database
              level - not just hidden in the interface - so no other account can read it without
              your explicit, revocable permission. We never sell your data, never train third-party
              models on it, and you control export and deletion entirely.
            </p>
            <Stagger className="mt-8 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
              {[
                "Per-user data isolation",
                "Granular consent controls",
                "One-tap export & deletion",
              ].map((t) => (
                <StaggerItem key={t}>
                  <div className="rounded-2xl bg-card/60 border border-border/60 px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-card cursor-default">
                    ✓ {t}
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            <div className="mt-8 pt-6 border-t border-border/60 max-w-2xl mx-auto">
              <p className="text-xs text-muted-foreground mb-3">
                Built around the principles of the world's major health-privacy frameworks - not a
                single-country product:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <a
                  href="https://www.hhs.gov/hipaa/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border/60 px-3 py-1.5 hover:text-foreground hover:border-primary/40 hover:-translate-y-0.5 transition"
                >
                  HIPAA · United States
                </a>
                <a
                  href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border/60 px-3 py-1.5 hover:text-foreground hover:border-primary/40 hover:-translate-y-0.5 transition"
                >
                  GDPR · European Union
                </a>
                <a
                  href="https://www.meity.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border/60 px-3 py-1.5 hover:text-foreground hover:border-primary/40 hover:-translate-y-0.5 transition"
                >
                  DPDP Act · India
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                These links go to the official regulator/government source for each framework. We're
                not yet formally certified under any of them - that's a milestone we're building
                toward as Raag grows - but the engineering practices above (encryption, per-user
                isolation, consent controls, deletion rights) are the same ones those frameworks
                require, applied from day one rather than bolted on later.
              </p>
            </div>
          </Lift>
        </Reveal>
      </section>

      {/* CTA */}
      <section id="pricing" className="max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
        <Reveal>
          <h2 className="font-display text-4xl md:text-6xl">
            Start understanding your health, today.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Free forever for personal use. Premium for advanced AI and family plans.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button
                size="lg"
                className="rounded-full gradient-primary text-white h-12 px-8 border-0 shadow-soft transition-transform hover:scale-105 active:scale-95"
              >
                Create your Raag
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full h-12 px-8 transition-all hover:border-primary/50 hover:-translate-y-0.5"
              >
                Sign in
              </Button>
            </Link>
          </div>
          <p className="mt-8 text-xs text-muted-foreground max-w-xl mx-auto">
            Raag provides informational wellness insights. It is not a substitute for professional
            medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.
          </p>
        </Reveal>
      </section>

      <footer className="border-t border-border/60 mt-10">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg gradient-primary">
              <Heart className="h-3.5 w-3.5 text-white" fill="white" />
            </div>
            © 2026 Raag, Inc.
          </div>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-foreground transition">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition">
              Terms
            </Link>
            <a href="#privacy" className="hover:text-foreground transition">
              Security & compliance
            </a>
            <a href="mailto:support@raag.app" className="hover:text-foreground transition">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: Brain,
    title: "AI Health Assistant",
    desc: "Ask anything about your records. Raag cites the exact reports and dates behind every answer.",
  },
  {
    icon: FileText,
    title: "Unified medical records",
    desc: "Upload PDFs, scans, prescriptions. Auto-parsed, tagged, and made searchable in seconds.",
  },
  {
    icon: Activity,
    title: "Lab results, translated",
    desc: "Interactive trend charts with plain-language explanations you can actually understand.",
  },
  {
    icon: Watch,
    title: "Every wearable, one view",
    desc: "Apple Health, Google Health Connect, Garmin, Fitbit, WHOOP, Oura - all synced.",
  },
  {
    icon: MessageSquare,
    title: "Meds & supplements",
    desc: "Smart reminders, adherence history, and interaction warnings across everything you take.",
  },
  {
    icon: Target,
    title: "Goals that matter",
    desc: "Sleep, sweat, nutrition, blood markers - track outcomes, not just activity.",
  },
];

const STEPS = [
  {
    title: "Connect once",
    desc: "Link your wearables, upload past records, and share your family history in a guided onboarding.",
  },
  {
    title: "Raag reads everything",
    desc: "Your labs, notes, and trends are parsed and unified into a single, private timeline.",
  },
  {
    title: "Get calm, useful insight",
    desc: "A daily brief tells you what changed, what it likely means, and what to consider - with citations.",
  },
];

function MockCard({
  tone,
  label,
  value,
  trend,
  icon: Icon,
}: {
  tone: "primary" | "teal" | "mint";
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const bg =
    tone === "primary"
      ? "gradient-primary text-white"
      : tone === "teal"
        ? "bg-teal/20 text-foreground"
        : "gradient-mint text-foreground";
  return (
    <Lift className={`rounded-2xl p-5 border border-border/40 cursor-default ${bg}`}>
      <div className="flex items-center justify-between text-xs opacity-80">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="font-display text-4xl mt-3">{value}</div>
      <div className="text-xs opacity-80 mt-1">{trend}</div>
    </Lift>
  );
}

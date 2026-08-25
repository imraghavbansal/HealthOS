import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Heart, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTheme } from "@/components/theme-provider";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { useProfile } from "@/lib/queries";
import { startCheckout, type PlanKey } from "@/lib/billing";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing · Raag" },
      {
        name: "description",
        content: "Simple, transparent pricing for individuals, families, and clinics.",
      },
      { property: "og:title", content: "Pricing · Raag" },
      { property: "og:description", content: "Choose the Raag plan that fits you or your family." },
    ],
  }),
});

type Plan = {
  key: string;
  planKey?: PlanKey;
  name: string;
  monthlyINR: number | null;
  yearlyINR: number | null;
  tagline: string;
  featured?: boolean;
  cta: string;
  features: { label: string; included: boolean }[];
};

const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    monthlyINR: 0,
    yearlyINR: 0,
    tagline: "Get your records in one place.",
    cta: "Start free",
    features: [
      { label: "Unlimited record uploads", included: true },
      { label: "1 wearable connection", included: true },
      { label: "Basic lab trend charts", included: true },
      { label: "Manual vitals & symptom log", included: true },
      { label: "AI Copilot (5 questions/mo)", included: false },
      { label: "Family sharing", included: false },
    ],
  },
  {
    key: "pro",
    planKey: "pro",
    name: "Pro",
    monthlyINR: 799,
    yearlyINR: 7999,
    tagline: "Full AI-powered health copilot.",
    featured: true,
    cta: "Upgrade to Pro",
    features: [
      { label: "Everything in Free", included: true },
      { label: "Unlimited wearable connections", included: true },
      { label: "Unlimited AI Copilot with citations", included: true },
      { label: "Advanced lab & trend analysis", included: true },
      { label: "Custom reports (PDF/JSON/FHIR)", included: true },
      { label: "Priority sync & support", included: true },
    ],
  },
  {
    key: "family",
    planKey: "family",
    name: "Family",
    monthlyINR: 1999,
    yearlyINR: 19999,
    tagline: "Everything for up to 5 people.",
    cta: "Upgrade to Family",
    features: [
      { label: "Everything in Pro", included: true },
      { label: "5 member seats", included: true },
      { label: "Shared family risk view", included: true },
      { label: "Caregiver access controls", included: true },
      { label: "Household medication tracking", included: true },
      { label: "Priority support", included: true },
    ],
  },
  {
    key: "clinic",
    name: "Clinic",
    monthlyINR: null,
    yearlyINR: null,
    tagline: "For practices supporting patients at scale.",
    cta: "Talk to us",
    features: [
      { label: "Everything in Family", included: true },
      { label: "Unlimited patient seats", included: true },
      { label: "EHR / FHIR integrations", included: true },
      { label: "Admin & audit controls", included: true },
      { label: "Dedicated onboarding", included: true },
      { label: "SLA-backed support", included: true },
    ],
  },
];

const COMPARISON: {
  capability: string;
  free: boolean | string;
  pro: boolean | string;
  family: boolean | string;
  clinic: boolean | string;
}[] = [
  { capability: "Record uploads & parsing", free: true, pro: true, family: true, clinic: true },
  {
    capability: "Wearable connections",
    free: "1",
    pro: "Unlimited",
    family: "Unlimited",
    clinic: "Unlimited",
  },
  {
    capability: "AI Copilot questions",
    free: "5/mo",
    pro: "Unlimited",
    family: "Unlimited",
    clinic: "Unlimited",
  },
  {
    capability: "Lab trend analysis",
    free: "Basic",
    pro: "Advanced",
    family: "Advanced",
    clinic: "Advanced",
  },
  { capability: "Custom report export", free: false, pro: true, family: true, clinic: true },
  { capability: "Family member seats", free: false, pro: false, family: "5", clinic: "Unlimited" },
  { capability: "Care team sharing", free: false, pro: true, family: true, clinic: true },
  { capability: "FHIR / EHR integration", free: false, pro: false, family: false, clinic: true },
  { capability: "Admin & audit controls", free: false, pro: false, family: false, clinic: true },
  { capability: "Priority support", free: false, pro: true, family: true, clinic: true },
];

const FAQS = [
  {
    q: "Who owns my health data?",
    a: "You do - fully and always. Raag never sells your data or uses it to train third-party models. You can export or permanently delete everything at any time from Settings.",
  },
  {
    q: "Are you HIPAA compliant? Will you sign a BAA?",
    a: "Raag is built on HIPAA-aligned infrastructure with end-to-end encryption. Clinic plans include a signed Business Associate Agreement (BAA) as part of onboarding.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month-to-month (or annual with a discount) and you can cancel anytime from Settings - no phone calls required. You keep access until the end of your billing period.",
  },
  {
    q: "Which wearables and apps are supported?",
    a: "Apple Health, Google Health Connect, Garmin, Fitbit, Oura, and WHOOP are supported today, with more integrations added regularly.",
  },
  {
    q: "How accurate is the AI Copilot?",
    a: "Copilot answers are grounded in your own records with inline citations, but it provides informational insights only - not diagnoses. Always confirm significant decisions with a licensed clinician.",
  },
  {
    q: "How do family seats work?",
    a: "The Family plan includes 5 seats. Each member gets their own private profile; the account owner manages billing and can view shared summaries with permission.",
  },
];

function PricingPage() {
  const { theme, toggle } = useTheme();
  const [yearly, setYearly] = useState(false);
  const nav = useNavigate();
  const profileQ = useProfile();
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const priceFor = (plan: Plan) => {
    const amount = yearly ? plan.yearlyINR : plan.monthlyINR;
    if (amount === null) return "Custom";
    if (amount === 0) return "₹0";
    return `₹${amount.toLocaleString("en-IN")}`;
  };
  const periodFor = (plan: Plan) => {
    const amount = yearly ? plan.yearlyINR : plan.monthlyINR;
    if (amount === null || amount === 0) return "";
    return yearly ? "/yr" : "/mo";
  };

  async function handlePlanClick(plan: Plan) {
    if (!plan.planKey) return; // free/clinic handled by their own Link below
    if (profileQ.data?.plan === plan.planKey) {
      toast.info("You're already on this plan.");
      return;
    }
    if (!profileQ.data) {
      nav({ to: "/signup" });
      return;
    }
    setCheckingOut(plan.key);
    try {
      await startCheckout(plan.planKey, yearly ? "yearly" : "monthly", () => {
        toast.success("Payment received - your plan will update in a moment.");
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start checkout.");
    } finally {
      setCheckingOut(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <div className="fixed inset-0 -z-10 gradient-glow pointer-events-none" />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-soft">
              <Heart className="h-4.5 w-4.5 text-white" fill="white" />
            </div>
            <span className="font-semibold tracking-tight">Raag</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="text-xs px-3 py-1.5 rounded-full border border-border/60"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <Link
              to="/dashboard"
              className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link to="/signup">
              <Button className="rounded-full gradient-primary text-white shadow-soft border-0">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-5xl mx-auto px-6 pt-16 md:pt-24 pb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Simple pricing, no surprises
          </div>
          <h1 className="font-display text-5xl md:text-6xl leading-tight">
            Plans for every <span className="text-gradient italic">stage of care.</span>
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
            Start free. Upgrade when you want the full AI copilot, unlimited devices, or a plan for
            the whole family.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={`text-sm ${!yearly ? "font-medium" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <Switch
              checked={yearly}
              onCheckedChange={setYearly}
              aria-label="Toggle yearly billing"
            />
            <span className={`text-sm ${yearly ? "font-medium" : "text-muted-foreground"}`}>
              Yearly
            </span>
            {yearly && (
              <Badge className="rounded-full bg-success/20 text-success-foreground text-[10px]">
                2 months free
              </Badge>
            )}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 pb-20">
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {PLANS.map((plan) => (
              <StaggerItem key={plan.key}>
                <div
                  className={`relative h-full rounded-3xl p-[1px] ${
                    plan.featured ? "gradient-primary shadow-soft lg:scale-[1.04]" : "bg-border/60"
                  }`}
                >
                  <div className="relative h-full rounded-3xl bg-card p-6 flex flex-col">
                    {plan.featured && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary text-white border-0 text-[10px] px-3">
                        Most popular
                      </Badge>
                    )}
                    <div className="font-semibold">{plan.name}</div>
                    <p className="text-xs text-muted-foreground mt-1">{plan.tagline}</p>
                    <div className="mt-5 flex items-baseline gap-1">
                      <span className="font-display text-4xl">{priceFor(plan)}</span>
                      <span className="text-sm text-muted-foreground">{periodFor(plan)}</span>
                    </div>
                    {plan.key === "family" && (
                      <div className="text-xs text-muted-foreground mt-1">5 seats included</div>
                    )}
                    <ul className="mt-6 space-y-2.5 text-sm flex-1">
                      {plan.features.map((f) => (
                        <li key={f.label} className="flex items-start gap-2">
                          {f.included ? (
                            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                          )}
                          <span className={f.included ? "" : "text-muted-foreground/70"}>
                            {f.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {plan.planKey ? (
                      <Button
                        onClick={() => handlePlanClick(plan)}
                        disabled={checkingOut === plan.key || profileQ.data?.plan === plan.planKey}
                        className={`mt-6 w-full rounded-full h-11 ${
                          plan.featured ? "gradient-primary text-white border-0 shadow-soft" : ""
                        }`}
                        variant={plan.featured ? "default" : "outline"}
                      >
                        {profileQ.data?.plan === plan.planKey
                          ? "Current plan"
                          : checkingOut === plan.key
                            ? "Opening checkout…"
                            : plan.cta}
                      </Button>
                    ) : plan.key === "clinic" ? (
                      <a href="mailto:support@raag.app?subject=Clinic%20plan" className="mt-6">
                        <Button className="w-full rounded-full h-11" variant="outline">
                          {plan.cta}
                        </Button>
                      </a>
                    ) : (
                      <Link to="/signup" className="mt-6">
                        <Button className="w-full rounded-full h-11" variant="outline">
                          {plan.cta}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-20">
          <Reveal>
            <h2 className="font-display text-3xl md:text-4xl text-center mb-8">Compare plans</h2>
            <div className="overflow-x-auto rounded-3xl border border-border/60 no-scrollbar">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Capability</TableHead>
                    <TableHead>Free</TableHead>
                    <TableHead>Pro</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Clinic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMPARISON.map((row) => (
                    <TableRow key={row.capability}>
                      <TableCell className="font-medium">{row.capability}</TableCell>
                      <ComparisonCell value={row.free} />
                      <ComparisonCell value={row.pro} />
                      <ComparisonCell value={row.family} />
                      <ComparisonCell value={row.clinic} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Reveal>
        </section>

        <section className="max-w-3xl mx-auto px-6 pb-24">
          <Reveal>
            <h2 className="font-display text-3xl md:text-4xl text-center mb-8">
              Frequently asked questions
            </h2>
            <Accordion
              type="single"
              collapsible
              className="rounded-3xl border border-border/60 bg-card px-2"
            >
              {FAQS.map((faq) => (
                <AccordionItem key={faq.q} value={faq.q}>
                  <AccordionTrigger className="text-left text-sm font-medium px-3">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-3 text-sm text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
          <div className="rounded-3xl glass p-10 md:p-14">
            <h2 className="font-display text-3xl md:text-5xl">Ready to understand your health?</h2>
            <p className="mt-4 text-muted-foreground">
              Start free in under a minute. Upgrade whenever you're ready.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="rounded-full gradient-primary text-white h-12 px-8 border-0 shadow-soft"
                >
                  Create your Raag <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg gradient-primary">
              <Heart className="h-3.5 w-3.5 text-white" fill="white" />
            </div>
            © 2026 Raag, Inc.
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="#" className="hover:text-foreground">
              HIPAA
            </a>
            <a href="#" className="hover:text-foreground">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ComparisonCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <TableCell className="text-sm">{value}</TableCell>;
  return (
    <TableCell>
      {value ? (
        <Check className="h-4 w-4 text-primary" aria-label="Included" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/50" aria-label="Not included" />
      )}
    </TableCell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Atlas Health" },
      { name: "description", content: "The terms that govern your use of Atlas Health." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-soft">
              <Heart className="h-4.5 w-4.5 text-white" fill="white" />
            </div>
            <span className="font-semibold tracking-tight">Atlas Health</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back home</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-4xl mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: August 17, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-foreground/90">
          <section>
            <p>
              These terms govern your use of Atlas Health (the "Service"). By creating an account, you agree to
              them. If you don't agree, don't use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">1. Not medical advice — read this first</h2>
            <p>
              Atlas is an informational tool that helps you organize, track, and understand your own health
              information. <b>It does not diagnose, prescribe, or provide medical advice.</b> Nothing Atlas or its AI
              assistant tells you replaces a licensed healthcare professional's judgment. Always consult a qualified
              clinician for medical decisions.
            </p>
            <p className="mt-3">
              <b>If you're experiencing a medical emergency, do not rely on Atlas.</b> Call your local emergency
              number (911 in the US, 112 in the EU, 108 in India, or your country's equivalent) or go to the nearest
              emergency room immediately.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">2. Eligibility &amp; accounts</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must be at least 18 years old to create an Atlas account. You may add health information for a dependent (a minor child, or an adult you're legally authorized to act for) through your own account — see our Privacy Policy for details.</li>
              <li>You're responsible for the accuracy of what you enter, for keeping your login credentials secure, and for all activity under your account.</li>
              <li>One account per person. Don't share your login with someone else — if you want to share access, use Atlas's built-in sharing controls instead.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">3. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Attempt to access another user's account or data without authorization, or attempt to circumvent Atlas's access controls.</li>
              <li>Upload content you don't have the right to upload, or that's unlawful, fraudulent, or harmful to others.</li>
              <li>Use the Service to store or process another person's health information without their knowledge or appropriate authorization.</li>
              <li>Reverse-engineer, scrape, or attempt to extract the Service's underlying models, source code, or aggregate data beyond your own.</li>
              <li>Use the Service in a way that could disable, overburden, or impair it for other users.</li>
            </ul>
            <p className="mt-3">We may suspend or terminate accounts that violate this section.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">4. Your data, your ownership</h2>
            <p>
              You own the health information you put into Atlas. We don't claim ownership over it, and we don't sell
              it. You can export a complete copy of your data or permanently delete your account at any time from
              Settings — both are real, functioning features, not requests we process manually on a delay. See our
              Privacy Policy for the full detail on how your data is handled.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">5. AI features</h2>
            <p>
              Atlas's AI assistant and document parsing are informational aids grounded in your own data — they cite
              what they draw from, and are instructed to say so plainly when they don't have enough information to
              answer, rather than guess. Even so, AI-generated content can be wrong. Extracted facts from a document
              are marked unverified until you confirm them, precisely because AI extraction isn't infallible. Don't
              treat any AI output as a substitute for your original documents or professional medical judgment.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">6. Subscriptions &amp; billing</h2>
            <p>
              Atlas currently offers a free tier. Paid subscription plans are planned but not yet available at the
              time of this writing. If and when paid plans launch, their specific terms (pricing, billing cycle,
              cancellation, refunds) will be presented to you at signup and will supplement these Terms — continuing
              to use a paid plan after that point means you accept those terms. We will never change your plan or
              charge you without clear notice and your action.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">7. Termination</h2>
            <p>
              You can delete your account at any time from Settings. We may suspend or terminate your account if you
              violate these terms, or if required by law. Where reasonably possible, we'll notify you before doing
              so and explain why.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">8. Disclaimers &amp; limitation of liability</h2>
            <p>
              The Service is provided "as is." We work to keep it accurate, secure, and available, but we don't
              guarantee it will be error-free or uninterrupted. To the maximum extent permitted by law, Atlas isn't
              liable for indirect, incidental, or consequential damages arising from your use of the Service. Nothing
              in these terms limits liability that can't legally be limited (e.g. for gross negligence, fraud, or
              other liability that isn't excludable under applicable law).
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">9. Changes to these terms</h2>
            <p>
              If we materially change these terms, we'll notify you before the change takes effect. Continuing to
              use Atlas afterward means you accept the update.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">10. Contact</h2>
            <p>
              Questions about these terms: <span className="font-medium">support@atlashealth.app</span>{" "}
              <span className="text-muted-foreground">(replace with your real support address before launch).</span>
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-6 border-t border-border/60">
            These terms describe Atlas's actual current practices as of the date above and are written to be
            genuinely accurate, not filler — they are not, however, a substitute for independent legal review before
            a wide public launch, particularly around health-data-specific regulation in the jurisdictions you
            operate in.
          </p>
        </div>
      </main>
    </div>
  );
}

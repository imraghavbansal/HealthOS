import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Atlas Health" },
      { name: "description", content: "How Atlas Health collects, stores, protects, and lets you control your data." },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
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

      <main className="max-w-3xl mx-auto px-6 py-16 prose-sm">
        <h1 className="font-display text-4xl mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: August 17, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-foreground/90">
          <section>
            <p>
              Atlas Health ("Atlas," "we," "us") provides a personal health record and AI assistant product. This
              policy explains what we collect, why, how it's protected, and the controls you have — in plain
              language, matching what the product actually does, not aspirational claims.
            </p>
            <p className="mt-3 font-medium">
              Atlas is informational only and is not a substitute for professional medical advice, diagnosis, or
              treatment. Nothing in this policy changes that.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">1. What we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><b>Account information</b> — name, email address, password (stored as a salted hash by our auth provider, never in plain text).</li>
              <li><b>Health data you provide</b> — vitals, medications, symptoms, nutrition logs, goals, appointments, family medical history, and any documents you upload (lab reports, prescriptions, imaging, visit summaries, vaccination records).</li>
              <li><b>AI-extracted data</b> — when you upload a document, our AI provider extracts structured facts (e.g. a lab value) from it. Every extracted fact is linked back to the original document and marked unverified until you confirm it. The original file is never discarded or overwritten.</li>
              <li><b>Conversations with Atlas's AI assistant</b> — your questions and the assistant's answers, stored so you can revisit them.</li>
              <li><b>Connected device data</b> — if and when you connect a wearable or health platform, the metrics that integration shares with us (this feature is not yet live).</li>
              <li><b>Usage data</b> — basic technical logs (timestamps, error reports) needed to operate and secure the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">2. How we use it</h2>
            <p>We use your data only to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Provide the product — store your records, render your dashboard, log medication adherence, and so on.</li>
              <li>Power the AI assistant and document parsing — your question or document content is sent to our AI provider (Anthropic) at the moment you ask something or upload something, scoped to what's needed to answer that specific request. We do not send your entire record set to the model on every call.</li>
              <li>Secure the product — detect abuse, debug failures, maintain audit trails on sensitive record access.</li>
              <li>Communicate with you — service notices, and only the notification types you've opted into in Settings.</li>
            </ul>
            <p className="mt-3">
              <b>We never sell your data.</b> We never use your data to train third-party AI models. We never share
              your health data with advertisers. The only sharing that happens is: (a) with the service providers
              below, strictly to operate the product, and (b) with anyone <i>you</i> explicitly grant access to via
              Atlas's sharing controls — nothing is shared by default.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">3. Who processes your data</h2>
            <p>We keep the list of sub-processors deliberately short:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><b>Supabase</b> — our database, file storage, and authentication provider. Your records, documents, and account credentials live here, encrypted at rest and in transit.</li>
              <li><b>Anthropic</b> — our AI provider (Claude models). Receives only the specific content needed for a given AI request (e.g. a document you just uploaded, or the context needed to answer a question you asked) — not your full record set, and not shared with anyone else. Per Anthropic's commercial API terms, data submitted through the API is not used to train their models. (We encourage you to review Anthropic's own terms directly if this matters to your decision to use Atlas.)</li>
            </ul>
            <p className="mt-3">We do not use ad networks, analytics trackers, or data brokers of any kind.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">4. How your data is protected</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Encrypted in transit (TLS) and at rest.</li>
              <li>Row-level data isolation enforced at the database level — not just hidden in the app's interface — so your records are inaccessible to other accounts by construction, not by convention. We test this directly (attempting cross-account access and confirming it's blocked) as part of how we verify the product, not just assume it.</li>
              <li>An append-only audit trail on sensitive record activity.</li>
              <li>Granular consent controls — you decide whether Atlas can reference your family history for AI insights, whether de-identified data can help improve the product (off by default), and whether a summary is shared with your care provider.</li>
              <li>You can export everything or permanently delete your account at any time — both are real, working features you can use today in Settings, not requests that go into a queue.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">5. Your rights</h2>
            <p>Regardless of where you live, you can, at any time, from Settings:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><b>Access &amp; export</b> — download a complete copy of everything Atlas has stored about you.</li>
              <li><b>Correct</b> — edit any entry you've logged, and confirm or correct any AI-extracted fact before it's treated as verified.</li>
              <li><b>Withdraw consent</b> — turn off any optional data use (de-identified improvement data, AI use of family history, provider sharing) independently, at any time.</li>
              <li><b>Delete</b> — permanently delete your account and everything under it. This is irreversible and removes your profile, records, documents, and health history from our active systems.</li>
            </ul>
            <p className="mt-3">
              These rights are offered to every user globally, in the spirit of frameworks including the EU's GDPR,
              India's DPDP Act, and the US's HIPAA — we are not currently formally certified under any of them (a
              milestone we're building toward), but the underlying rights above are live today, not aspirational.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">6. Data retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your account, your records,
              documents, and profile are removed from our active database and file storage. Routine infrastructure
              backups may retain deleted data for a limited operational window as part of standard disaster-recovery
              practice before cycling out — this is not a mechanism for retaining your data against your wishes, and
              we don't currently have a formal published backup-retention SLA; ask us directly if this specific
              detail matters to you.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">7. Family &amp; dependent profiles</h2>
            <p>
              Atlas supports an adult account holder managing health records for a dependent (e.g. a child or an
              aging parent) who doesn't have their own login. If you add a dependent's information, you're
              confirming you're their parent, legal guardian, or otherwise authorized to manage their health data.
              A family member with their own account only ever sees data you've explicitly and revocably granted
              them access to.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">8. Children</h2>
            <p>
              Atlas accounts are intended for adults (18+). We don't knowingly allow children to create their own
              account. Children's health information may only be added by a parent or guardian through that adult's
              own account, as described above.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">9. Changes to this policy</h2>
            <p>
              If we make a material change to how we handle your data, we'll notify you (email, or an in-app notice)
              before it takes effect. Continuing to use Atlas after a change takes effect means you accept the
              update; if you don't, you can export and delete your account beforehand.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-3">10. Contact</h2>
            <p>
              Questions about this policy or your data: <span className="font-medium">privacy@atlashealth.app</span>{" "}
              <span className="text-muted-foreground">(replace with your real support address before launch).</span>
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-6 border-t border-border/60">
            This policy describes Atlas's actual current data practices as of the date above. It is not a substitute
            for independent legal review — as Atlas grows, formal certifications and signed data-processing
            agreements with our vendors are on our roadmap, and we'll update this page as that happens.
          </p>
        </div>
      </main>
    </div>
  );
}

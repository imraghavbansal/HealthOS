# Orvana — Product Vision (North Star)

This is the standing product context for Orvana. Read this before making any
product or architecture decision. Do not redesign the product into a
different concept — the existing UI, screens, and direction are the
foundation. The job is to make them real, trustworthy, and worth paying for.

## What Orvana is

A long-term personal and family **health operating system** — a secure place
where a person's health information continuously accumulates, stays
organized, and becomes more useful over time. Not a collection of
disconnected features (records here, meds there, a chatbot bolted on).
**Everything feeds one continuous longitudinal health record per person.**

A user should return months or years later and still have their complete,
understandable history.

## The core differentiator

Orvana is not "an AI health chatbot," "a record locker," "a tracker," or "a
family app." Those are components. The product is:

> **Orvana remembers your health over time and helps you understand the
> bigger picture.**

The AI reasons over the user's accumulated, authorized context — it does not
treat every conversation as a blank slate. It should be able to answer:
"What's changed in my health over the last few years?", "Show me everything
related to this lab result", "What changed around when my sleep started
changing?", "Summarize my relevant history for my doctor." Answers are
grounded in the user's real records, with visible provenance.

## The moat

Not Claude, not GPT — models are replaceable and will change. The moat is:

**longitudinal data + structured history + original documents + timeline +
AI memory/context + family relationships + integrations + trust.**

Flywheel: more data → better context → more useful Orvana → more usage → more
history → stronger personalization → higher retention. A new user has a few
records; a multi-year user has an irreplaceable structured history no
competitor can hand them on day one.

## Family is a system, not a field

Not "add a family member as a text row." A real household model:

**One household → each person has their own independent health history →
granular, revocable sharing permissions → shared care workflows.**

One family member never automatically sees another's private data. This
means two genuinely different concepts must stay separate in the data model:

- **Inherited family history** — ancestry/genetic risk info entered about
  relatives who are not Orvana users themselves (mother's hypothyroidism,
  paternal CAD). Free-text, informational, feeds the risk engine only.
- **Family circle / household** — living people who *are* Orvana subjects
  (either full account holders, or a dependent profile managed by an adult
  — e.g. a child or an aging parent without their own login), each with
  their own record set and their own access grants.

## Data must be real and persistent

No demo/mock data in the product a real user touches. Sign up, upload a PDF,
log a med, record sleep, add an appointment, talk to Orvana, add a family
member — it's stored for real and there when they come back, for years.

**Source documents and extracted structure are stored separately.** The
original PDF/scan is the source of truth; anything Orvana parses out of it
(a lab value, a medication, a diagnosed condition) is its own row with a
link back to the document it came from, a confidence signal, and a way for
the user to confirm or correct it. Never overwrite or discard the original.

## AI sits above the health data, not beside it

Not a generic chatbot with a health skin. The flow:

**question → identify relevant context → retrieve authorized structured data
+ documents → ground the model in that context → generate a cited answer →
persist the conversation as part of the user's history.**

Two retrieval paths, not one: structured queries against the timeline
(lab trends, medication history, vitals over time) for "what changed"
questions, and semantic/document search for "what does this report say"
questions. Grounded answers cite what they used. The AI never diagnoses —
it helps the user understand, organize, and prepare for a real clinician.

Keep the model provider swappable (start: Anthropic/Claude) behind one
interface — never let the product architecture assume a specific model.

## Trust is a product requirement, not a later pass

Strong auth, strict authorization, row-level data isolation, private
document storage, secure family permissions, secrets only ever touched
server-side, clear data ownership, reliable persistence/backups, provenance
on AI-touched information, and a clear line between *user data*,
*extracted information*, and *AI interpretation*. Orvana never pretends to be
a doctor.

## Scale posture

Architect for years of accumulated data per person, large document
collections, continuous wearable ingestion, family accounts, growing AI
context, more integrations, subscriptions, and eventually provider
partnerships — **without over-building for hypothetical millions of users
today.** Production-quality foundations, not premature infrastructure.
Supabase/Postgres, secure storage, real auth/authz, Anthropic first —
services stay cleanly separated so any one piece can be swapped later
without a rewrite.

## North star

> Orvana becomes the place where a person and their family build a lifelong,
> continuously updated health history — with an intelligent system that
> actually understands it.

Not the most features. **Indispensable because it remembers, connects, and
understands over time.**

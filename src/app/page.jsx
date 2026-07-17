import { Check } from "lucide-react";
import Link from "next/link";
import SiteFooter from "../components/site/SiteFooter";
import SiteHeader from "../components/site/SiteHeader";

/**
 * Public homepage. This is the page that has to rank, so the SEO surface is part
 * of the component, not an afterthought:
 *   - one <h1>, sections under <h2>, real landmarks (header/main/footer)
 *   - canonical + OG/Twitter via `metadata`
 *   - Organization + WebSite + FAQPage JSON-LD
 *   - the FAQ answers are written to be quotable verbatim by an AI summariser
 *
 * ★ COPY IS A COMPLIANCE SURFACE. data/roles.json scopes reviewers to
 *   feedback:submit — never review:post-external, never reward:withdraw tied to
 *   a public post. Nothing on this page may imply we pay for, place, or remove
 *   reviews, because the product deliberately cannot do it. That honesty is also
 *   the only defensible differentiator against every "buy reviews" competitor,
 *   so it leads rather than hides in a footer.
 */
export const metadata = {
  title: "ReviewHub — Customer feedback that stays honest",
  description:
    "Collect private customer feedback, monitor your Google Business Profile, and reply faster. ReviewHub never buys, sells, posts, or removes reviews.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ReviewHub — Customer feedback that stays honest",
    description:
      "Collect private customer feedback, monitor your Google Business Profile, and reply faster. ReviewHub never buys, sells, posts, or removes reviews.",
    url: "/",
  },
};

const STEPS = [
  {
    title: "Ask every customer",
    body: "Share a link or QR code after a visit. Customers answer in seconds — no app, no account, no login wall.",
  },
  {
    title: "Read what they actually said",
    body: "Feedback lands in your dashboard first, privately. You see the problem before it becomes a public one-star.",
  },
  {
    title: "Reply where it counts",
    body: "Connect your Google Business Profile to see incoming reviews and respond from one place, faster.",
  },
];

const FAQ = [
  {
    q: "Does ReviewHub pay people to write reviews?",
    a: "No. ReviewHub never pays for reviews, never posts reviews on your behalf, and never removes negative ones. Paying for reviews violates Google's policies and consumer protection law in most markets, and it puts the business — not the vendor — at risk. ReviewHub collects private first-party feedback and helps you respond to public reviews you already have.",
  },
  {
    q: "How is this different from a review-gating tool?",
    a: "Review gating filters unhappy customers away from public review sites, which Google prohibits. ReviewHub does not gate. Private feedback and public reviews are separate things here: feedback comes to you directly, and every customer keeps the same right to post publicly wherever they like.",
  },
  {
    q: "Do customers need an account to leave feedback?",
    a: "No. Customers open a link and answer. An account is only needed if they want to track their own submissions over time.",
  },
  {
    q: "What does ReviewHub do with my Google Business Profile?",
    a: "With your permission, it reads your reviews and lets you reply from the dashboard. It never posts a review, never edits a rating, and the connection can be revoked from your Google account at any time.",
  },
];

// Consumed by Google for rich results and by AI answer engines as a citable
// source. Keep the answers byte-identical to the rendered <dd> text below —
// schema that disagrees with the visible page is a manual-action risk.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "/#organization",
      name: "ReviewHub",
      url: "/",
      description:
        "Customer feedback and Google Business Profile management that never buys, sells, posts, or removes reviews.",
    },
    {
      "@type": "WebSite",
      "@id": "/#website",
      url: "/",
      name: "ReviewHub",
      publisher: { "@id": "/#organization" },
      inLanguage: "en-IN",
    },
    {
      "@type": "FAQPage",
      "@id": "/#faq",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static object, no user input — nothing here can be injected.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
          <p className="pill-verified inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            No bought reviews. No gating. Ever.
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold text-primary sm:text-5xl lg:text-6xl">
            Customer feedback that stays honest
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-secondary">
            Collect private feedback from real customers, watch your Google Business Profile, and
            reply faster — without paying for a single star.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup/business"
              className="rounded-btn bg-accent px-5 py-3 text-center font-medium text-on-brand transition hover:bg-accent-hover"
            >
              Start collecting feedback
            </Link>
            <Link
              href="/signup/reviewer"
              className="rounded-btn border border-strong px-5 py-3 text-center font-medium text-primary transition hover:bg-surface-sunken"
            >
              I want to leave feedback
            </Link>
          </div>

          <p className="mt-4 text-sm text-muted">Free to start. No card required.</p>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-default bg-surface-sunken py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-semibold text-primary sm:text-3xl">How ReviewHub works</h2>
            <p className="mt-3 max-w-2xl text-secondary">
              Three steps, and none of them involve writing a review for someone else.
            </p>

            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-card border border-default bg-surface-raised p-6">
                  <span className="nums pill-accent inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-primary">{s.title}</h3>
                  <p className="mt-2 text-sm text-secondary">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust — the actual differentiator, stated plainly. */}
        <section aria-labelledby="trust-heading" className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 id="trust-heading" className="max-w-2xl text-2xl font-semibold text-primary sm:text-3xl">
            Most review tools quietly break the rules. We built ReviewHub so it can&rsquo;t.
          </h2>
          <p className="mt-3 max-w-2xl text-secondary">
            Buying reviews and filtering out unhappy customers both violate Google&rsquo;s policies —
            and it is the business that gets penalised, not the vendor that sold the service.
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "We never buy, sell, or write reviews",
              "We never post to Google on your behalf",
              "We never hide or filter unhappy customers",
              "We never delete a review you don't like",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-primary">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-verified" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ — rendered text must match the JSON-LD above. */}
        <section id="faq" className="border-t border-default bg-surface-sunken py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-semibold text-primary sm:text-3xl">Common questions</h2>
            <dl className="mt-8 space-y-6">
              {FAQ.map((f) => (
                <div key={f.q} className="rounded-card border border-default bg-surface-raised p-6">
                  <dt className="font-semibold text-primary">{f.q}</dt>
                  <dd className="mt-2 text-secondary">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
          <h2 className="text-2xl font-semibold text-primary sm:text-3xl">
            Find out what your customers actually think
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-secondary">
            Set up in minutes. Your first honest piece of feedback is worth more than ten bought
            stars.
          </p>
          <Link
            href="/signup/business"
            className="mt-8 inline-block rounded-btn bg-accent px-6 py-3 font-medium text-on-brand transition hover:bg-accent-hover"
          >
            Get started free
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

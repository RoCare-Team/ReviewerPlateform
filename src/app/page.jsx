import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Container from "../components/site/Container";
import Reveal from "../components/site/Reveal";
import Faq, { FAQ_ITEMS } from "../components/site/Faq";
import Hero from "../components/site/Hero";
import HowItProfits from "../components/site/HowItProfits";
import LogoMarquee from "../components/site/LogoMarquee";
import PopularServices from "../components/site/PopularServices";
import Pricing from "../components/site/Pricing";
import Services from "../components/site/Services";
import Stats from "../components/site/Stats";
import SiteFooter from "../components/site/SiteFooter";
import SiteHeader from "../components/site/SiteHeader";
import Testimonials from "../components/site/Testimonials";

/**
 * Public homepage — composed from section components in components/site. The page
 * itself owns only page-level concerns: metadata, JSON-LD, and section order.
 *
 * ★ COPY IS A COMPLIANCE SURFACE. data/roles.json scopes reviewers to
 *   feedback:submit — reward is for VERIFIED PARTICIPATION, never for positive
 *   reviews, and never gated. Every section is written to that line. It is also
 *   the only defensible position against "buy reviews" competitors, so it leads.
 */
export const metadata = {
  title: "ReviewHub — Grow your reputation with verified customer reviews",
  description:
    "Collect authentic reviews across Google, Play Store, Trustpilot, G2 and more. Reviewers are rewarded for verified participation — never for positive ratings, never gated.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ReviewHub — Grow your reputation with verified customer reviews",
    description:
      "Collect authentic reviews across Google, Play Store, Trustpilot, G2 and more. Reviewers rewarded for verified participation, never for positive ratings.",
    url: "/",
  },
};

// Built from the same FAQ_ITEMS the page renders, so schema and visible text can
// never drift. Organization + WebSite + FAQPage.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "/#organization",
      name: "ReviewHub",
      url: "/",
      description:
        "Review and reputation management platform. Collects verified reviews across major platforms and rewards reviewers for verified participation, never for positive ratings.",
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
      mainEntity: FAQ_ITEMS.map((f) => ({
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
        <Hero />
        <LogoMarquee />
        <Services />
        <Stats />
        <PopularServices />
        <HowItProfits />
        <Pricing />
        <Testimonials />
        <Faq />

        {/* 
          Closing CTA: Upgraded from plain centered text into an elegant, 
          glowing panel card. This provides a clear high-contrast focal endpoint 
          for visitors reaching the end of the landing page.
        */}
        <section className="py-16 sm:py-24 bg-background">
          <Container>
            <Reveal className="group relative overflow-hidden rounded-3xl border border-default/60 bg-surface-raised px-6 py-12 text-center shadow-xl transition-shadow duration-500 hover:shadow-2xl sm:px-12 sm:py-20">
              {/* Decorative background visual blurs inside the panel — drifting
                  out of phase so the panel feels alive without distracting. */}
              <div
                className="animate-float pointer-events-none absolute -right-16 -top-16 -z-10 h-72 w-72 rounded-full bg-accent/10 blur-[90px]"
                aria-hidden="true"
              />
              <div
                className="animate-float pointer-events-none absolute -bottom-16 -left-16 -z-10 h-72 w-72 rounded-full bg-accent/5 blur-[90px] [animation-delay:-3.5s]"
                aria-hidden="true"
              />

              {/* Eyebrow Label to anchor context */}
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                Get Started Today
              </p>

              {/* Headline with thick, tight, balanced typography */}
              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">
                Start collecting reviews you can actually stand behind
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-secondary sm:text-lg">
                Set up your first campaign in minutes. No card required to
                start.
              </p>

              {/* Polished Interactive Buttons */}
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup/business"
                  className="group/cta inline-flex items-center justify-center gap-2 rounded-btn bg-accent px-6 py-3 text-sm font-bold text-on-brand shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
                >
                  Start free trial
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/contact"
                  className="rounded-btn border border-strong bg-surface px-6 py-3 text-sm font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-sunken hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong active:scale-[0.98]"
                >
                  Book a demo
                </Link>
              </div>
            </Reveal>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

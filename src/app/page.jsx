import Faq, { FAQ_ITEMS } from "../components/site/Faq";
import Hero from "../components/site/Hero";
import HowItProfits from "../components/site/HowItProfits";
import LogoMarquee from "../components/site/LogoMarquee";
import PopularServices from "../components/site/PopularServices";
// import Pricing from "../components/site/Pricing";
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
  title: "RapportLook — Grow your reputation with verified customer reviews",
  description:
    "Collect authentic reviews across Google, Play Store, Trustpilot, G2 and more. Reviewers are rewarded for verified participation — never for positive ratings, never gated.",
  keywords: [
    "verified customer reviews",
    "review collection platform",
    "Google reviews",
    "Trustpilot reviews",
    "reputation management software",
    "customer feedback rewards",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "RapportLook — Grow your reputation with verified customer reviews",
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
      name: "RapportLook",
      url: "/",
      description:
        "Review and reputation management platform. Collects verified reviews across major platforms and rewards reviewers for verified participation, never for positive ratings.",
    },
    {
      "@type": "WebSite",
      "@id": "/#website",
      url: "/",
      name: "RapportLook",
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
        <HowItProfits />
        {/* <Pricing /> */}
        <PopularServices />

        <Testimonials />
        <Faq />
      </main>

      <SiteFooter />
    </>
  );
}

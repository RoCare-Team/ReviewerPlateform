import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Star,
  Shield,
  Users,
  Compass,
  ChevronDown,
} from "lucide-react";
import Container from "../../../components/site/Container";
import SiteHeader from "../../../components/site/SiteHeader";
import SiteFooter from "../../../components/site/SiteFooter";
import { getCity, getCities, getCitySlugs } from "../../../lib/cities";

// Prerender one static page per known city.
export function generateStaticParams() {
  return getCitySlugs().map((city) => ({ city }));
}

export async function generateMetadata({ params }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};

  const title = `Verified customer reviews in ${city.name} — ReviewHub`;
  const description = `Collect verified customer reviews in ${city.name}, ${city.region} across ${city.platforms.join(", ")}. Reviewers rewarded for verified participation, never for positive ratings.`;

  return {
    title,
    description,
    alternates: { canonical: `/services/${city.slug}` },
    openGraph: { title, description, url: `/services/${city.slug}` },
  };
}

export default async function CityPage({ params }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();

  const highlights = [
    `${city.businesses} local businesses collecting verified feedback`,
    `Seamless coverage across ${city.platforms.join(", ")}`,
    "Screenshot + AI verification on every submission before it counts",
    "Reviewers rewarded for verified participation, never for positive ratings",
  ];

  // Industries that most commonly run local review campaigns — SEO-relevant
  // long-tail coverage, framed generically (not fabricated per-city claims).
  const industries = [
    "Restaurants & cafés",
    "Healthcare & clinics",
    "Retail & D2C brands",
    "Home & local services",
    "Automotive",
    "Education & coaching",
    "Real estate",
    "IT & SaaS",
  ];

  // Other cities for internal linking — strong for crawl depth and topical SEO.
  const otherCities = getCities().filter((c) => c.slug !== city.slug);

  // Structured data: BreadcrumbList + a Service offered in this city. Built from
  // the same fields the page renders, so schema and visible text can't drift.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "/" },
          { "@type": "ListItem", position: 2, name: "Popular cities", item: "/#popular" },
          { "@type": "ListItem", position: 3, name: city.name, item: `/services/${city.slug}` },
        ],
      },
      {
        "@type": "Service",
        name: `Verified customer review collection in ${city.name}`,
        serviceType: "Review and reputation management",
        areaServed: { "@type": "City", name: city.name },
        provider: { "@type": "Organization", name: "ReviewHub", url: "/" },
        description: `Collect verified customer reviews in ${city.name}, ${city.region} across ${city.platforms.join(", ")}. Reviewers are rewarded for verified participation, never for positive ratings.`,
        url: `/services/${city.slug}`,
      },
    ],
  };

  const localSteps = [
    {
      Icon: Compass,
      title: "Set location target",
      body: `Specify your physical branches or service radius within ${city.name} to target reviewers who genuinely visit your business.`,
    },
    {
      Icon: Shield,
      title: "Screen verified proof",
      body: "Our AI checks screenshot metadata, device fingerprinting, and IP routing to ensure the reviewer was actually at your listing.",
    },
    {
      Icon: Users,
      title: "Build lasting trust",
      body: "Grow an organic, policy-compliant reputation that platforms like Google and Trustpilot recognize as authentic.",
    },
  ];

  const localFaqs = [
    {
      q: `Is location targeting in ${city.name} safe against platform flags?`,
      a: "Yes. Because we reward verified participation, not positive reviews, and never restrict unhappy users from rating honestly, your campaigns remain fully compliant with Google Business Profile and local consumer protection guidelines.",
    },
    {
      q: "Can we run campaigns for multiple branch locations?",
      a: `Absolutely. You can distribute your review campaigns across multiple physical outlets or service zones in ${city.name} directly from a single centralized wallet.`,
    },
    {
      q: `How does ReviewHub verify reviews from ${city.name}?`,
      a: "Every submission goes through screenshot proof plus AI validation, along with device fingerprinting and IP monitoring, before it counts. This catches duplicate accounts, fake screenshots and repeat reviews so only genuine, verified participation is rewarded.",
    },
    {
      q: `Which review platforms are supported in ${city.name}?`,
      a: `You can collect and monitor reviews across ${city.platforms.join(", ")} and more — all from a single ReviewHub dashboard, with platform-wise analytics.`,
    },
    {
      q: "Do reviewers get paid for leaving positive reviews?",
      a: "Never. Reviewers are rewarded only for verified participation, not for the sentiment of their rating. Honest, critical feedback earns exactly the same reward — this is what keeps your campaigns policy-compliant.",
    },
    {
      q: `How quickly can a ${city.name} business get started?`,
      a: "Most businesses launch their first campaign in under two minutes. Add your review URLs, set a budget and frequency, and start collecting — no credit card required to begin the free trial.",
    },
    {
      q: "What does it cost to run review campaigns?",
      a: "Plans scale from a free trial up to Growth, Business and Enterprise tiers, billed transparently with GST shown up front. You fund campaigns from a wallet and only pay for verified participation.",
    },
  ];

  // Add the visible local FAQs to the structured data so they can qualify for
  // FAQ rich results — same text the page renders, no drift.
  jsonLd["@graph"].push({
    "@type": "FAQPage",
    mainEntity: localFaqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });

  return (
    <>
      <script
        type="application/ld+json"
        // Static object built from city data — no user input, nothing injectable.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader />

      <main className="bg-background">
        {/* 1. Hero — theme-aligned split layout: text on a light accent-tinted
            background, city photo as a rounded card on the right. */}
        <section className="relative isolate overflow-hidden bg-background">
          {/* Soft accent glow, matching the brand theme (not per-city colors) */}
          <div
            className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-accent/10 blur-[110px]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-24 bottom-0 -z-10 h-80 w-80 rounded-full bg-accent/5 blur-[100px]"
            aria-hidden="true"
          />

          {/* Breadcrumb / back row — its own line, above the split */}
          <Container className="pt-8 sm:pt-10">
            <Link
              href="/#popular"
              className="inline-flex items-center gap-1.5 rounded-md text-xs font-bold uppercase tracking-widest text-muted transition hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to popular cities
            </Link>
          </Container>

          <Container className="grid items-center gap-10 pb-14 pt-6 sm:pb-16 lg:grid-cols-2 lg:gap-14 lg:pb-20">
            {/* Left: text */}
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-subtle px-3 py-1 text-xs font-semibold text-accent">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {city.region}
              </p>

              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.1]">
                Review Services in {city.name}
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-secondary sm:text-lg">
                Collect verified customer reviews for your {city.name} business across{" "}
                {city.platforms.slice(0, 3).join(", ")} and 100+ platforms — reviewers rewarded for
                verified participation, never for positive ratings.
              </p>

              {/* Metric badges */}
              <div className="mt-7 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-default bg-surface-raised px-3.5 py-1.5 text-sm font-bold text-primary shadow-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {city.avgRating} Avg local rating
                </span>
                <span className="inline-flex items-center rounded-full border border-default bg-surface-raised px-3.5 py-1.5 text-sm font-bold text-primary shadow-sm">
                  {city.businesses} Active businesses
                </span>
              </div>

              {/* Quick highlights */}
              <ul className="mt-7 space-y-2.5">
                {[
                  `Verified reviews across ${city.platforms.slice(0, 3).join(", ")} and more`,
                  "Screenshot + AI verification on every submission",
                  "Reviewers rewarded for verified participation, never for positive ratings",
                ].map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-sm text-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-verified" aria-hidden="true" />
                    <span className="font-medium leading-relaxed">{h}</span>
                  </li>
                ))}
              </ul>

              {/* CTAs */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup/business"
                  className="inline-flex items-center justify-center rounded-btn bg-accent px-6 py-3 text-center text-sm font-bold text-on-brand shadow-md transition-all duration-200 hover:bg-accent-hover hover:shadow-lg active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Start free trial
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-btn border border-strong bg-surface px-6 py-3 text-center text-sm font-bold text-primary transition-all duration-200 hover:bg-surface-sunken active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
                >
                  Book a demo
                </Link>
              </div>
            </div>

            {/* Right: city photo card */}
            <div className="relative">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-default shadow-xl">
                <Image
                  src={city.image}
                  alt={`${city.name}, ${city.region}`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                {/* City name plate over the photo */}
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-5">
                  <span className="inline-flex items-center gap-2 text-lg font-bold text-white drop-shadow">
                    <span className="text-2xl" aria-hidden="true">{city.emoji}</span>
                    {city.name}
                  </span>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* About / What is this — keyword-rich SEO intro */}
        <section className="py-8 sm:py-12 border-b border-default/60 bg-surface-sunken">
          <Container className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Overview</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary">
              What is ReviewHub in {city.name}?
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-secondary sm:text-lg">
              <p>
                ReviewHub is a review and reputation management platform that helps {city.name}{" "}
                businesses collect authentic, verified customer reviews across{" "}
                {city.platforms.join(", ")} and 100+ other platforms — all from a single dashboard.
                Instead of chasing feedback manually, you launch a campaign, share your review links,
                and track every submission as it comes in.
              </p>
              <p>
                What makes it different is the compliance model. Reviewers in {city.region} are
                rewarded for <strong className="font-semibold text-primary">verified participation</strong>,
                never for leaving a positive rating. Every review is confirmed with screenshot proof,
                AI validation, device fingerprinting and IP monitoring before it counts — so your
                reputation grows on genuine feedback that stands up to scrutiny from Google, Trustpilot
                and consumer-protection guidelines.
              </p>
              <p>
                Whether you run a single storefront or multiple branches across {city.name}, you can
                fund campaigns from one wallet, monitor platform-wise analytics, and turn honest
                customer experiences into a trustworthy public reputation.
              </p>
            </div>
          </Container>
        </section>

        {/* 2. Detail body & sticky aside CTA */}
        <section className="py-8 sm:py-12 border-b border-default/60">
          <Container>
            <div className="grid gap-12 lg:grid-cols-3 lg:gap-16">
              
              {/* Left Column: Content Details */}
              <div className="lg:col-span-2">
                <h2 className="text-3xl font-extrabold tracking-tight text-primary">
                  Why {city.name} businesses choose ReviewHub
                </h2>
                <p className="mt-4 text-base leading-relaxed text-secondary sm:text-lg">
                  {city.blurb}
                </p>

                {/* Checked Highlights list utilizing standard design system icon style */}
                <ul className="mt-10 space-y-4">
                  {highlights.map((h) => (
                    <li key={h} className="flex items-start gap-3.5 text-secondary">
                      <span className="mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-accent/10 border border-accent/25 text-accent">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold leading-relaxed sm:text-base">{h}</span>
                    </li>
                  ))}
                </ul>

                {/* Dynamic Monitored Platforms tag section */}
                <div className="mt-12 border-t border-default/60 pt-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
                    Platforms monitored in this zone
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {city.platforms.map((p) => (
                      <span
                        key={p}
                        className="rounded-full bg-accent/10 border border-accent/15 px-3.5 py-1 text-xs font-bold text-accent"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Sticky Aside Card */}
              <aside className="lg:col-span-1">
                <div className="rounded-card border border-default bg-surface-raised p-6 shadow-md lg:sticky lg:top-28">
                  <h3 className="text-lg font-bold text-primary">
                    Start collecting in {city.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">
                    Launch your first location campaign in minutes. No card required to start.
                  </p>

                  {/* Quick facts */}
                  <dl className="mt-6 divide-y divide-default/60 border-y border-default/60">
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-sm text-secondary">Avg local rating</dt>
                      <dd className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                        {city.avgRating}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-sm text-secondary">Active businesses</dt>
                      <dd className="text-sm font-bold text-primary">{city.businesses}</dd>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-sm text-secondary">Platforms covered</dt>
                      <dd className="text-sm font-bold text-primary">{city.platforms.length}</dd>
                    </div>
                  </dl>

                  <div className="mt-6 flex flex-col gap-3">
                    <Link
                      href="/signup/business"
                      className="rounded-btn bg-accent px-4 py-2.5 text-center text-sm font-bold text-on-brand shadow-md transition-all duration-200 hover:bg-accent-hover hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      Start free trial
                    </Link>
                    <Link
                      href="/contact"
                      className="rounded-btn border border-strong bg-surface px-4 py-2.5 text-center text-sm font-bold text-primary transition-all duration-200 hover:bg-surface-sunken active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-strong"
                    >
                      Book a demo
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </Container>
        </section>

        {/* NEW SECTION 1: Local Campaign Flow / Steps */}
        <section className="py-8 sm:py-12 border-b border-default/60 bg-surface-sunken">
          <Container>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                The Process
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary">
                Smarter verification for {city.name} campaigns
              </h2>
              <p className="mt-4 text-base leading-relaxed text-secondary">
                We handle location targeting and IP validation, so you collect authentic feedback
                from reviewers who are genuinely in and around {city.name}.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {localSteps.map(({ Icon, title, body }) => (
                <div key={title} className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/25 text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-primary">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Industries served — long-tail SEO coverage */}
        <section className="py-8 sm:py-12 border-b border-default/60">
          <Container>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                Who it&rsquo;s for
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary">
                Industries collecting reviews in {city.name}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-secondary">
                From high-street retail to multi-location service brands, {city.name} businesses use
                ReviewHub to build a verified, policy-compliant reputation.
              </p>
            </div>

            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {industries.map((ind) => (
                <li
                  key={ind}
                  className="flex items-center gap-2.5 rounded-card border border-default bg-surface-raised px-4 py-3 text-sm font-semibold text-primary shadow-sm"
                >
                  <Check className="h-4 w-4 shrink-0 text-verified" aria-hidden="true" />
                  {ind}
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* Other cities — internal linking for SEO crawl depth */}
        <section className="py-8 sm:py-12 border-b border-default/60 bg-surface-sunken">
          <Container>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                Explore more
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary">
                Review services in other cities
              </h2>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherCities.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/services/${c.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span>
                      <span className="flex items-center gap-2 text-base font-bold text-primary">
                        <span className="text-xl" aria-hidden="true">{c.emoji}</span>
                        {c.name}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-muted">{c.region}</span>
                    </span>
                    <ArrowRight
                      className="h-5 w-5 shrink-0 text-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* NEW SECTION 2: Dynamic Local Trust & Compliance FAQs */}
        <section className="py-8 sm:py-12">
          <Container className="max-w-3xl">
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                Location Compliance
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary">
                Local FAQ for {city.name}
              </h2>
            </div>

            <dl className="mt-10 space-y-3.5">
              {localFaqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-card border border-default bg-surface-raised px-5 transition-all duration-300 hover:border-strong/60 shadow-sm [&_summary]:list-none"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 font-semibold text-primary transition-colors duration-150 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-md">
                    <dt className="text-sm sm:text-base select-none">{faq.q}</dt>
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180 group-open:text-accent"
                      aria-hidden="true"
                    />
                  </summary>
                  <dd className="pb-5 text-sm sm:text-base leading-relaxed text-secondary">
                    {faq.a}
                  </dd>
                </details>
              ))}
            </dl>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, MapPin, Star, Shield, Users, Compass, ChevronDown } from "lucide-react";
import Container from "../../../components/site/Container";
import SiteHeader from "../../../components/site/SiteHeader";
import SiteFooter from "../../../components/site/SiteFooter";
import { getCity, getCitySlugs } from "../../../lib/cities";

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
  ];

  return (
    <>
      <SiteHeader />

      <main className="bg-background">
        {/* 1. Hero banner — real city photo behind a vibrant overlay */}
        <section className={`relative isolate overflow-hidden bg-linear-to-br ${city.gradient} min-h-[400px] flex items-center`}>
          <Image
            src={city.image}
            alt={`${city.name}, ${city.region}`}
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover brightness-[0.75]"
          />
          {/* Overlay keeps white text highly legible over any city photo */}
          <div
            className={`absolute inset-0 -z-10 bg-linear-to-br ${city.gradient} opacity-75`}
            aria-hidden="true"
          />
          <div className="absolute inset-0 -z-10 bg-black/35" aria-hidden="true" />
          
          <Container className="py-16 text-white sm:py-20">
            <Link
              href="/#popular"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to popular cities
            </Link>

            <div className="mt-8 flex items-center gap-5">
              <span className="text-5xl sm:text-6xl drop-shadow filter" aria-hidden="true">
                {city.emoji}
              </span>
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-white/90">
                  <MapPin className="h-4.5 w-4.5 text-accent" aria-hidden="true" />
                  {city.region}
                </p>
                <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                  {city.name}
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/95">{city.tagline}</p>

            {/* Structured Metric Badges */}
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                {city.avgRating} Avg local rating
              </span>
              <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white border border-white/20 backdrop-blur-sm">
                {city.businesses} Active businesses
              </span>
            </div>
          </Container>
        </section>

        {/* 2. Detail body & sticky aside CTA */}
        <section className="py-16 sm:py-20 border-b border-default/60">
          <Container>
            <div className="grid gap-12 lg:grid-cols-3 lg:gap-16">
              
              {/* Left Column: Content Details */}
              <div className="lg:col-span-2">
                <h2 className="text-3xl font-extrabold tracking-tight text-primary">
                  Review services in {city.name}
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
        <section className="py-16 sm:py-20 border-b border-default/60 bg-surface-sunken">
          <Container>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                The Process
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary">
                Smarter verification for {city.name} campaigns
              </h2>
              <p className="mt-4 text-base leading-relaxed text-secondary">
                We handle location tracking and IP validations, ensuring you acquire authentic feedback from reviewers physically located in the region [1.2.6].
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

        {/* NEW SECTION 2: Dynamic Local Trust & Compliance FAQs */}
        <section className="py-16 sm:py-20">
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
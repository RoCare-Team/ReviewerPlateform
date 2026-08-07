import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Ban,
  Users2,
  Sparkles,
  Target,
  Heart,
  UserPlus,
  ScanSearch,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";
import Container from "../../components/site/Container";
import Reveal from "../../components/site/Reveal";
import SiteHeader from "../../components/site/SiteHeader";
import SiteFooter from "../../components/site/SiteFooter";
import { getContact } from "../../lib/contact";

const BRAND_NAME = getContact("brand.productName", "RapportLook");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rapportlook.com";

const TITLE = `About us — ${BRAND_NAME}`;
const DESCRIPTION =
  "RapportLook helps businesses collect verified customer reviews without ever paying for a rating. Learn what we stand for and why participation is verified, never bought.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "about RapportLook",
    "verified reviews company",
    "review platform mission",
    "reputation management company",
  ],
  alternates: { canonical: "/about" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Optional editorial image for the "Our story" section. Checked at render
// time so this page never ships a broken <img> — drop a file at this path
// (see the image brief in the PR/chat that added this page) and it appears
// automatically; until then, the section falls back to an icon panel.
const STORY_IMAGE = "/img/about-story.png";
const hasStoryImage = fs.existsSync(path.join(process.cwd(), "public", STORY_IMAGE));

// Same compliance line as the rest of the site (see src/app/page.jsx copy
// note) — the reward is for verified participation, never a rating.
const VALUES = [
  {
    Icon: ShieldCheck,
    title: "Verification over volume",
    text: "Every submission is screenshot- and AI-checked before it counts. We'd rather ship fewer, real reviews than a bigger, fake number.",
  },
  {
    Icon: Ban,
    title: "Never pay for a rating",
    text: "Reviewers are rewarded for verified participation — submitting real proof of a real interaction. Never for what the review says, positive or negative.",
  },
  {
    Icon: Users2,
    title: "Built for both sides",
    text: "A business gets an honest reputation signal. A reviewer gets paid fairly for their time. Neither has to trust the other blindly — the platform verifies.",
  },
  {
    Icon: Sparkles,
    title: "Policy-compliant by default",
    text: "Google, Trustpilot and every platform we support explicitly prohibit incentivized ratings. Our reward structure is designed to stay on the right side of that line, not skirt it.",
  },
];

const STEPS = [
  {
    Icon: UserPlus,
    step: "01",
    title: "A customer participates",
    text: "A real customer leaves a review on Google, Trustpilot, or any supported platform, then submits proof inside RapportLook.",
  },
  {
    Icon: ScanSearch,
    step: "02",
    title: "We verify, not judge",
    text: "Screenshot and AI checks confirm the submission is genuine — the decision never looks at whether the review is positive or negative.",
  },
  {
    Icon: BadgeCheck,
    step: "03",
    title: "Reward, every time",
    text: "Verified participation is paid out on the spot. The business gets an honest signal; the reviewer gets paid fairly for real activity.",
  },
];

const STATS = [
  { value: "10+", label: "Review platforms in one dashboard" },
  { value: "100%", label: "Submissions verified before they count" },
  { value: "2,500+", label: "Businesses trust our verification" },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${SITE_URL}/about#about`,
        url: `${SITE_URL}/about`,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { "@type": "WebSite", name: BRAND_NAME, url: SITE_URL },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: BRAND_NAME,
        url: SITE_URL,
        description: DESCRIPTION,
      },
    ],
  };

  return (
    <>
      <SiteHeader />

      <main className="bg-background">
        {/* Hero band — same treatment as the legal pages' header, so About
            reads as part of the same site rather than a bolted-on page. */}
        <section className="relative overflow-hidden border-b border-default/60 bg-surface-sunken py-16 sm:py-20">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-xl -translate-x-1/2 rounded-full bg-accent/10 blur-[100px]"
            aria-hidden="true"
          />
          <Container className="max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">About us</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">
              A review platform built to stay honest
            </h1>
            <p className="mt-5 text-base leading-relaxed text-secondary sm:text-lg">
              {BRAND_NAME} helps businesses collect verified customer reviews across Google, Trustpilot,
              Play Store, G2 and more — without ever paying for a rating. We built the platform we wished
              existed: one where "verified" actually means something.
            </p>
          </Container>
        </section>

        {/* Our story — text + image, or an icon panel if the image isn't
            shipped yet (see hasStoryImage above). */}
        <section className="py-16 sm:py-20">
          <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Our story</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                We got tired of watching "reviews" mean nothing
              </h2>
              <div className="mt-5 space-y-4 text-base leading-relaxed text-secondary">
                <p>
                  Every review platform has the same rule buried in its policy: don't pay for ratings,
                  don't gate rewards on sentiment. And every business trying to grow its reputation runs
                  straight into the temptation to break it — because the honest way is slower, and the
                  platforms that promise shortcuts rarely mention the suspension risk that comes with them.
                </p>
                <p>
                  {BRAND_NAME} exists because we think that trade-off is a false one. A review program can
                  be fast <em>and</em> compliant, if the thing you reward is proof of a genuine interaction
                  instead of a star count. That single distinction — verify the participation, never the
                  opinion — is the whole product.
                </p>
              </div>
              <Link
                href="/signup"
                className="mt-7 inline-flex items-center gap-2 rounded-btn bg-accent px-6 py-3 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
              >
                Start collecting verified reviews
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Reveal>

            <Reveal delay={80}>
              {hasStoryImage ? (
                <Image
                  src={STORY_IMAGE}
                  alt={`The ${BRAND_NAME} team reviewing verified customer feedback together`}
                  width={1200}
                  height={900}
                  className="w-full rounded-card border border-default object-cover shadow-lg"
                />
              ) : (
                <div className="relative overflow-hidden rounded-card border border-default bg-surface-raised p-10 shadow-sm">
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col items-center gap-4 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
                      <ShieldCheck className="h-8 w-8" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold text-secondary">
                      Verified participation, never a bought rating — the rule every part of the product
                      is built around.
                    </p>
                  </div>
                </div>
              )}
            </Reveal>
          </Container>
        </section>

        {/* Mission */}
        <section className="border-t border-default/60 bg-surface-sunken py-16 sm:py-20">
          <Container className="max-w-3xl">
            <Reveal className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
                <Target className="h-5.5 w-5.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">Our mission</h2>
                <p className="mt-3 text-base leading-relaxed text-secondary">
                  Most review platforms quietly optimize for star ratings — filtering out negative
                  feedback, gating rewards on a positive score, or looking the other way on fake
                  activity. That's a compliance risk for the business and a broken incentive for
                  everyone else. {BRAND_NAME} does the opposite: we verify that a review is genuine,
                  not what it says. A business's reputation stays real, and a reviewer gets paid for
                  honest participation — good review or bad.
                </p>
              </div>
            </Reveal>
          </Container>
        </section>

        {/* How it works — 3 steps */}
        <section className="py-16 sm:py-20">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">How it works</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                Verification, not judgment
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ Icon, step, title, text }, i) => (
                <Reveal key={step} delay={i * 80} className="relative">
                  <span className="nums text-5xl font-bold text-accent/15">{step}</span>
                  <span className="-mt-9 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
                    <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-primary">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{text}</p>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Values grid */}
        <section className="border-t border-default/60 bg-surface-sunken py-16 sm:py-20">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                What we stand for
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {VALUES.map(({ Icon, title, text }, i) => (
                <Reveal
                  key={title}
                  delay={i * 70}
                  className="rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
                    <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-primary">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{text}</p>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Stats band */}
        <section className="py-16 sm:py-20">
          <Container>
            <Reveal
              as="dl"
              className="grid grid-cols-1 gap-y-10 gap-x-6 overflow-hidden rounded-card border border-default bg-surface-raised p-8 shadow-sm sm:grid-cols-3 sm:p-12"
            >
              {STATS.map(({ value, label }, index) => (
                <div
                  key={label}
                  className={`flex flex-col items-center px-4 text-center ${
                    index !== 0 ? "sm:border-l sm:border-default/60" : ""
                  }`}
                >
                  <dt className="nums text-4xl font-bold tracking-tight text-accent sm:text-5xl">
                    {value}
                  </dt>
                  <dd className="mt-3 max-w-56 text-sm font-semibold leading-relaxed text-secondary">
                    {label}
                  </dd>
                </div>
              ))}
            </Reveal>
          </Container>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-default/60 bg-surface-sunken py-16 sm:py-20">
          <Container className="max-w-2xl text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
              <Heart className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-5 text-lg font-semibold leading-relaxed text-primary">
              We're a small team building the review platform we'd want our own business to use —
              one rating at a time, verified.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-btn bg-accent px-6 py-3 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
              >
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-btn border border-strong bg-surface px-6 py-3 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-sunken hover:shadow-sm"
              >
                Talk to us
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}

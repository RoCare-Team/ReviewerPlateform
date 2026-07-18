import { ArrowRight, Check, ShieldCheck, TrendingUp, Users, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Container from "./Container";

/**
 * Hero — text + CTAs on the left, product illustration on the right (stacks on
 * mobile).
 *
 * Copy note (see src/app/page.jsx): the reward is framed as "verified
 * participation", never "positive reviews". That wording is not decoration — it
 * is what keeps the product on the right side of Google/Trustpilot policy and
 * consistent with the reviewer permission scope in data/roles.json.
 */
const CHIPS = [
  { Icon: TrendingUp, label: "Increase visibility" },
  { Icon: Users, label: "Build trust" },
  { Icon: TrendingUp, label: "Drive more sales" },
];

const TRUST = ["No credit card required", "14-day free trial", "Cancel anytime"];

// Real platform logos shipped in public/img. Only the icons we actually have
// are listed — no placeholders.
const LOGOS = [
  // `cls` tunes each logo's rendered height: the PNGs have different intrinsic
  // aspect ratios and transparent padding, so a single height looks uneven.
  { src: "/img/google.png", alt: "Google", width: 512, height: 512, cls: "h-6" },
  { src: "/img/trustpilot.png", alt: "Trustpilot", width: 3840, height: 2160, cls: "h-9" },
  { src: "/img/Capterra.png", alt: "Capterra", width: 820, height: 189, cls: "h-5" },
];

export default function Hero() {
  return (
    <section className="relative flex min-h-[calc(100dvh-var(--header-h))] items-center overflow-hidden bg-background">
      {/* Decorative ambient background blur behind the hero content for subtle depth */}
      <div
        className="pointer-events-none absolute -left-1/4 top-1/4 -z-10 h-96 w-96 rounded-full bg-accent/10 blur-[100px]"
        aria-hidden="true"
      />

      <Container className="grid items-center gap-12 pt-4 pb-10 sm:pt-6 sm:pb-12 lg:grid-cols-2 lg:gap-12 lg:pt-8 lg:pb-16">
        {/* Left: Content Block */}
        <div className="flex flex-col items-start">
          {/* Badge Pill */}
          <p className="pill-verified inline-flex items-center gap-1.5 rounded-full border border-success/15 bg-success/5 px-3 py-1 text-xs font-semibold tracking-wide text-verified">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Policy-compliant Review Collection
          </p>

          {/* Title — "verified" highlighted in the brand accent */}
<h1 className="mt-6 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
  Grow your reputation with{" "}
  <span className="text-accent">verified</span> customer reviews
</h1>

          {/* Subtext */}
          <p className="mt-5 max-w-xl text-base leading-relaxed text-secondary sm:text-lg">
            Collect authentic reviews across Google Business Profile, Play Store, Trustpilot, G2 and
            100+ platforms — with reviewers rewarded for verified participation, not for saying nice
            things.
          </p>

          {/* Feature chips */}
          <ul className="mt-7 flex flex-wrap gap-2.5">
            {CHIPS.map(({ Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-default bg-surface-raised px-3.5 py-1.5 text-sm font-semibold text-secondary shadow-sm"
              >
                <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          {/* Call to Actions */}
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/signup/business"
              className="group inline-flex items-center justify-center gap-2 rounded-btn bg-accent px-6 py-3.5 text-center font-semibold text-on-brand shadow-sm transition-all duration-200 hover:bg-accent-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
            >
              Start free trial
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/contact"
              className="rounded-btn border border-strong bg-surface px-6 py-3.5 text-center font-semibold text-primary transition-all duration-200 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong active:scale-[0.98]"
            >
              Book a demo
            </Link>
          </div>

          {/* Trust indicators */}
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {TRUST.map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary">
                <Check className="h-4 w-4 text-verified" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>

          {/* Trusted-by social proof */}
          <div className="mt-10 w-full border-t border-default/60 pt-6">
            <p className="text-xs font-medium text-muted">Trusted by 2,500+ businesses worldwide</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="inline-flex items-center gap-2">
                <span className="flex" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </span>
                <span className="text-sm font-bold text-primary">4.8/5</span>
              </span>
              <span className="h-4 w-px bg-default" aria-hidden="true" />
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {LOGOS.map((l) => (
                  <li key={l.alt} className="flex items-center">
                    <Image
                      src={l.src}
                      alt={l.alt}
                      width={l.width}
                      height={l.height}
                      className={`${l.cls} w-auto object-contain`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right: Product illustration (dashboard mockup + floating review cards) */}
        <div className="relative flex items-center justify-center lg:justify-end">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-radial-gradient from-accent/5 to-transparent blur-2xl"
            aria-hidden="true"
          />

          <Image
            src="/img/hero.png"
            alt="ReviewHub dashboard showing verified reviews, ratings over time and reviews by platform"
            width={1536}
            height={1024}
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="h-auto w-full object-contain"
          />
        </div>
      </Container>
    </section>
  );
}

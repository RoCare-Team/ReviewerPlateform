import Link from "next/link";
import { Check } from "lucide-react";
import Container from "./Container";
import {
  getPlans,
  priceWithGst,
  formatInr,
  slaFor,
  GST_PERCENT,
  TRIAL,
} from "../../lib/plans";

/**
 * Pricing section. All figures come from data/plan.json via src/lib/plans.js —
 * never hardcode a price or entitlement here. Copy stays participation-framed:
 * the metered unit is "feedback responses", never "reviews" (see plan.json's
 * own compliance notes).
 *
 * The GST-inclusive total is shown up front on purpose. plan.json flags a
 * late-revealed inclusive price as drip pricing — a named dark pattern under the
 * 2023 Guidelines — so we surface it on the card, not at checkout.
 */

const ANALYTICS_LABEL = {
  basic: "Basic analytics",
  advanced: "Advanced analytics",
  advanced_plus_custom: "Advanced analytics + custom reports",
  advanced_plus_bi_export: "Advanced analytics + BI export",
};

// Build the visible bullet list for a plan straight from its data, so cards can
// never drift from the entitlements the app actually enforces.
function bulletsFor(plan) {
  const { limits, features } = plan;
  const bullets = [];

  bullets.push(
    `${limits.campaignsDisplay ?? limits.campaigns} ${
      limits.campaignsDisplay ? "campaigns" : limits.campaigns === 1 ? "campaign" : "campaigns"
    }`
  );
  bullets.push(
    `${
      limits.feedbackResponsesDisplay ??
      limits.feedbackResponsesPerMonth?.toLocaleString("en-IN")
    } feedback responses / month`
  );
  bullets.push(`${limits.locationsDisplay ?? limits.locations} locations`);
  bullets.push(`${limits.teamSeatsDisplay ?? limits.teamSeats} team seats`);

  if (ANALYTICS_LABEL[features.analytics]) bullets.push(ANALYTICS_LABEL[features.analytics]);
  if (features.aiSentiment) bullets.push("AI sentiment analysis");
  if (features.aiReplyDrafting) bullets.push("AI reply drafting (suggested, never auto-posted)");
  if (features.whiteLabel) bullets.push("White-label solution");
  if (features.apiAccess) {
    bullets.push(features.apiAccess === "full" ? "Full API access" : "API access (read)");
  }
  if (features.dedicatedManager) bullets.push("Dedicated success manager");

  const sla = slaFor(plan);
  if (sla) bullets.push(sla);

  return bullets;
}

export default function Pricing() {
  const plans = getPlans();

  return (
    <section id="pricing" className="py-20 sm:py-24 bg-background">
      <Container>
        {/* Header with visual label, bold typography, and comfortable reading container */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Plans & Cost
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            Simple pricing for honest growth
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-base leading-relaxed text-secondary sm:text-lg">
            Every plan pays for verified participation and platform coverage — never for a single
            positive rating. {TRIAL.days}-day free trial, {TRIAL.cardRequired ? "card" : "no card"}{" "}
            required.
          </p>
        </div>

        {/* Responsive Grid Layout */}
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:gap-6 xl:grid-cols-4">
          {plans.map((plan) => {
            const inclusive = priceWithGst(plan);
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-card border bg-surface-raised p-6 pt-10 shadow-sm transition-all duration-300 ${
                  plan.popular
                    ? "border-accent ring-1 ring-accent/35 shadow-xl shadow-accent/5 lg:-translate-y-2"
                    : "border-default hover:border-strong/60"
                }`}
              >
                {/* 
                  "Most popular" floating badge positioned absolute-center 
                  overlapping the top border card boundary.
                */}
                {plan.popular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-on-brand shadow-md">
                    Most popular
                  </span>
                )}
                
                {/* Plan Header */}
                <div>
                  <h3 className="text-xl font-bold text-primary">{plan.name}</h3>
                  
                  {/* Primary Pricing Figure */}
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
                      {plan.priceDisplay}
                    </span>
                    {plan.billingPeriod && (
                      <span className="text-sm font-semibold text-secondary">/{plan.billingPeriod}</span>
                    )}
                  </p>
                  
                  {/* Direct, Transparent Tax Inclusivity Details */}
                  <p className="mt-2 text-xs font-medium text-muted leading-relaxed">
                    {inclusive != null
                      ? `${formatInr(inclusive)}/${plan.billingPeriod} incl. ${GST_PERCENT}% GST`
                      : "Custom pricing — GST as applicable"}
                  </p>
                </div>

                {/* Styled Divider separating plan headers and details */}
                <div className="my-6 border-t border-default/65" />

                {/* Feature Entitlements Bullet List */}
                <ul className="space-y-3.5 text-sm text-secondary flex-grow">
                  {bulletsFor(plan).map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="leading-tight font-medium">{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Call to Actions (CTA) */}
                <Link
                  href={plan.cta.href}
                  className={`mt-8 w-full rounded-btn px-4 py-3 text-center font-bold text-sm transition-all duration-200 active:scale-[0.98] ${
                    plan.popular
                      ? "bg-accent text-on-brand hover:bg-accent-hover shadow-md hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      : "border border-strong bg-surface text-primary hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
                  }`}
                >
                  {plan.cta.label}
                </Link>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
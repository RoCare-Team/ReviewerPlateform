import planData from "../../data/plan.json";
import { resolveRef, isPlaceholder } from "./contact";

/**
 * The ONLY reader of data/plan.json. Import from here, never the JSON directly.
 *
 * Compliance surface — read data/plan.json's own notes before changing anything
 * here. In particular: the metered unit is "feedback responses", never "reviews".
 */

export const CURRENCY = planData.currency;
export const CURRENCY_SYMBOL = planData.currencySymbol;
export const GST_PERCENT = planData.gstPercent;
export const TRIAL = planData.trial;
export const BILLING = planData.billing;
export const COMPARISON_ROWS = planData.comparisonRows;

export function getPlans() {
  return planData.plans;
}

export function getPlan(id) {
  return planData.plans.find((p) => p.id === id) ?? null;
}

/**
 * GST-inclusive total in rupees.
 *
 * plan.json says the inclusive figure must be shown BEFORE the payment step —
 * revealing it at the last screen is drip pricing, a named dark pattern under the
 * 2023 Guidelines. Use this anywhere a price is displayed, not just at checkout.
 */
export function priceWithGst(plan) {
  if (plan?.priceMonthly == null) return null;
  if (planData.pricesIncludeGst) return plan.priceMonthly;
  return Math.round(plan.priceMonthly * (1 + planData.gstPercent / 100));
}

export function formatInr(amount) {
  if (amount == null) return null;
  return `${planData.currencySymbol}${amount.toLocaleString("en-IN")}`;
}

/** Support SLA text for a plan, resolved out of contact.json. */
export function slaFor(plan) {
  return resolveRef(plan?.supportSlaRef);
}

/**
 * Pre-launch gate. plan.json ships with deliberate TODOs that must not reach
 * production — an "Unlimited" tier with an unpublished fair-use cap is exactly
 * what the Guidelines prohibit, and every blurb is still a placeholder.
 *
 * Call this from a CI check or the pricing page in dev; don't let it be silent.
 */
export function pricingBlockers() {
  const blockers = [];

  if (planData.annualDiscountPercent === null) {
    blockers.push("plan.json: annualDiscountPercent is null — state the % plainly or remove annual billing.");
  }

  for (const plan of planData.plans) {
    if (isPlaceholder(plan.blurb)) {
      blockers.push(`plan.json: ${plan.id}.blurb is a placeholder.`);
    }

    const cap = plan.limits?.feedbackResponsesFairUseCap;
    const claimsUnlimited = plan.limits?.feedbackResponsesDisplay === "Unlimited";
    if (claimsUnlimited && isPlaceholder(cap)) {
      blockers.push(
        `plan.json: ${plan.id} advertises "Unlimited" feedback responses but feedbackResponsesFairUseCap is unset. ` +
          `Publish the cap as a footnote on /pricing, or stop saying "Unlimited".`
      );
    }

    if (slaFor(plan) === null) {
      blockers.push(`contact.json: ${plan.supportSlaRef} is unset — ${plan.id} has no support SLA to show.`);
    }
  }

  return blockers;
}

export { planData as raw };

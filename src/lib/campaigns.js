/**
 * Campaign economics. Single source of truth for the review rate so the form
 * preview, the server validation and the stored campaign can't drift.
 */
// Fallback default only. The live rate is admin-controlled via lib/settings.js
// (AppSettings.reviewRate) — always pass that rate in rather than relying on this.
export const RATE_PER_REVIEW = 100; // ₹ per verified review (default)

/** Approx reviews a budget buys at the given rate (defaults to the fallback). */
export function approxReviews(budget, rate = RATE_PER_REVIEW) {
  const b = Number(budget);
  const r = Number(rate) || RATE_PER_REVIEW;
  if (!Number.isFinite(b) || b <= 0) return 0;
  return Math.floor(b / r);
}

export function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/**
 * The effective list of cities a campaign is restricted to — `[]` means open
 * to any city. Resolves the new `cities` array (multi-city picker) against
 * the legacy single `city` field (still what batch/multi-location campaigns
 * write) so every caller checks exactly one thing instead of both fields
 * separately. `cities` wins when both are somehow set (it's the newer,
 * more-specific one); `city` is the fallback for campaigns created before
 * `cities` existed.
 */
export function campaignCities(campaign) {
  if (Array.isArray(campaign?.cities) && campaign.cities.length > 0) {
    return campaign.cities.map((c) => String(c).trim()).filter(Boolean);
  }
  return campaign?.city ? [String(campaign.city).trim()] : [];
}

/**
 * True if `reviewerCity` (case-insensitive) is allowed to see this campaign.
 * A reviewer with no declared city still sees every campaign — matches the
 * original single-city behavior, where an empty reviewer city never excluded
 * anything. In practice this never comes up: city is mandatory at reviewer
 * signup (PhoneOtpForm.jsx).
 */
export function campaignOpenToCity(campaign, reviewerCity) {
  const cities = campaignCities(campaign);
  if (cities.length === 0 || !reviewerCity) return true;
  const target = String(reviewerCity).trim().toLowerCase();
  return cities.some((c) => c.toLowerCase() === target);
}

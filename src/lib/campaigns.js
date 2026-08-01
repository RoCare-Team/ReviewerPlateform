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

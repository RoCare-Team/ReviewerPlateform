/**
 * Campaign economics. Single source of truth for the review rate so the form
 * preview, the server validation and the stored campaign can't drift.
 */
export const RATE_PER_REVIEW = 100; // ₹ per verified review

/** Approx reviews a budget buys at the flat rate. */
export function approxReviews(budget) {
  const b = Number(budget);
  if (!Number.isFinite(b) || b <= 0) return 0;
  return Math.floor(b / RATE_PER_REVIEW);
}

export function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

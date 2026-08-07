import GmbConnection from "../models/GmbConnection";
import GmbLocation from "../models/GmbLocation";
import GmbReview from "../models/GmbReview";
import { syncConnectionReviews } from "./gmb";

/**
 * Step 2 of the reviewer-submission verification (step 1 is the AI screenshot
 * check, see lib/aiVerification.js): confirm the reviewer's review actually
 * shows up on the business's connected Google Business Profile location.
 *
 * Only runs when the campaign is linked to a GmbLocation (Campaign.location).
 * Campaigns without a linked location skip this step entirely — the AI
 * screenshot check alone decides them, same as before this feature existed.
 *
 * Matching is name-based best-effort (Google gives no way to tie a review to
 * *our* reviewer account): the review's reviewerName is compared against the
 * submitting reviewer's platform name, and must have been posted after the
 * campaign started. This is intentionally permissive rather than exact —
 * false negatives just fall back to admin review, they never block a real
 * reviewer from getting paid outright.
 */

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/** True if the two names share at least one significant (3+ letter) word. */
function namesLikelyMatch(a, b) {
  const wordsA = normalizeName(a);
  const wordsB = new Set(normalizeName(b));
  return wordsA.some((w) => wordsB.has(w));
}

/**
 * Returns:
 *  - { checked: false, reason }                                — campaign has no linked GMB location.
 *  - { checked: true, matched: true, reviewId, reason }         — a matching review was found on Google.
 *  - { checked: true, matched: false, reason }                  — location is linked but no matching review found (yet).
 */
export async function verifyAgainstGmb({ campaign, reviewerUser }) {
  if (!campaign.location) {
    return { checked: false, matched: false, reason: "Campaign isn't linked to a Google Business Profile location." };
  }

  const location = await GmbLocation.findById(campaign.location);
  if (!location) {
    return { checked: false, matched: false, reason: "Linked Google Business Profile location not found." };
  }

  const conn = await GmbConnection.findOne({ _id: location.connection, status: "active" }).select(
    "+accessToken +refreshToken"
  );
  if (!conn) {
    return { checked: false, matched: false, reason: "Business's Google account isn't connected." };
  }

  // Pull fresh reviews right now — the reviewer just submitted, so a stale
  // (e.g. hours-old) DB copy could miss a review posted minutes ago.
  try {
    await syncConnectionReviews(conn, [location]);
  } catch {
    // Fall through and match against whatever's already synced — a live-sync
    // failure (rate limit, expired token) shouldn't block matching entirely.
  }

  const reviews = await GmbReview.find({
    location: location._id,
    createTime: { $gte: campaign.createdAt },
  })
    .sort({ createTime: -1 })
    .limit(100)
    .lean();

  const match = reviews.find((r) => namesLikelyMatch(reviewerUser.name, r.reviewerName));
  if (match) {
    return {
      checked: true,
      matched: true,
      reviewId: match.reviewId,
      reason: `Matching review by "${match.reviewerName}" found on Google (${match.starRating}★).`,
    };
  }

  return {
    checked: true,
    matched: false,
    reason: "No matching review found yet on the business's Google Business Profile.",
  };
}

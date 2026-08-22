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

  // Not scoped to status:"active" — a revoked/errored connection still gets
  // looked up so the reason below can say WHY sync will fail, instead of a
  // flat "not connected" that reads as if the business never connected one
  // at all. See models/GmbConnection.js's status enum.
  const conn = await GmbConnection.findOne({ _id: location.connection }).select("+accessToken +refreshToken");
  if (!conn) {
    return { checked: false, matched: false, reason: "Business's Google account isn't connected." };
  }
  if (conn.status === "revoked" || conn.status === "error") {
    return {
      checked: false,
      matched: false,
      reason: conn.lastError || "Business's Google account needs reconnecting before reviews can be checked.",
    };
  }

  // Pull fresh reviews right now — the reviewer just submitted, so a stale
  // (e.g. hours-old) DB copy could miss a review posted minutes ago.
  // syncConnectionReviews() never throws (per-location failures land in
  // `errors` instead) — surfaced below rather than discarded, so a sync
  // that's silently failing every single time (expired token, API not
  // allowlisted, rate limited) shows up as a real reason instead of the
  // generic "not found yet" that reads as "just keep waiting" when actually
  // nothing is being checked at all.
  const { errors: syncErrors } = await syncConnectionReviews(conn, [location]);

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
    reason:
      syncErrors.length > 0
        ? `Couldn't fetch the latest reviews from Google (${syncErrors[0]}) — matching against what was last synced.`
        : "No matching review found yet on the business's Google Business Profile.",
  };
}

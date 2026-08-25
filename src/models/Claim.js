import mongoose from "mongoose";

/**
 * A temporary slot reservation: a reviewer clicked "Open review link" for a
 * campaign and now has CLAIM_TTL_MINUTES to submit a screenshot before the
 * slot is released back to the pool. This is what stops a campaign that
 * needs, say, 5 reviews from being handed out to every active reviewer —
 * the review link (and therefore the real Google review) is only revealed
 * once a slot is actually reserved.
 *
 * `expiresAt` is deliberately NOT a native Mongo TTL index — it used to be,
 * but that let Mongo's own background sweep (runs independently, roughly
 * once a minute) delete an expired claim's document a beat before
 * lib/claims.js#releaseExpiredClaims() got to it. That function is the ONLY
 * place Campaign.claimed gets decremented for an expired claim; if Mongo
 * deletes the doc first, releaseExpiredClaims() finds nothing left to act
 * on and the slot it was holding leaks — `claimed` stays permanently too
 * high, silently blocking a real open slot from ever being reclaimed. Now
 * expiry is ONLY ever applied by that function (called before every claim
 * attempt, on every reviewer campaigns-list page load, and by the
 * release-expired-claims cron — see vercel.json) so the delete and the
 * counter decrement always happen together, atomically, never racing.
 */
export const CLAIM_TTL_MINUTES = 30;

const ClaimSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },

    // The Campaign.reviewDrafts entry (if any were available) handed to this
    // reviewer — denormalized `text` so the client never needs a second
    // lookup, `draftId` so releasing this claim can free the same entry back
    // to Campaign.reviewDrafts. Null when the campaign has no draft pool.
    reviewDraft: {
      draftId: { type: mongoose.Schema.Types.ObjectId, default: null },
      text: { type: String, default: "" },
    },

    // Same idea as reviewDraft above, but the Campaign.reviewImages entry
    // (if any were available) — an image for the reviewer to download and
    // attach to the review they post.
    reviewImage: {
      imageId: { type: mongoose.Schema.Types.ObjectId, default: null },
      url: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

// One live claim per reviewer per campaign — re-opening the link renews the
// same claim (see lib/claims.js) instead of creating a second one.
ClaimSchema.index({ campaign: 1, reviewer: 1 }, { unique: true });
// Plain (non-TTL) index — still speeds up releaseExpiredClaims()'s
// `expiresAt: { $lte: now }` query, just without Mongo auto-deleting on its
// own. See this file's docblock for why that auto-delete was removed.
ClaimSchema.index({ expiresAt: 1 });

export default mongoose.models.Claim || mongoose.model("Claim", ClaimSchema);

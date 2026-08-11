import mongoose from "mongoose";

/**
 * A temporary slot reservation: a reviewer clicked "Open review link" for a
 * campaign and now has CLAIM_TTL_MINUTES to submit a screenshot before the
 * slot is released back to the pool. This is what stops a campaign that
 * needs, say, 5 reviews from being handed out to every active reviewer —
 * the review link (and therefore the real Google review) is only revealed
 * once a slot is actually reserved.
 *
 * `expiresAt` carries a TTL index so Mongo auto-deletes an abandoned claim
 * (reviewer opened the link but never submitted) — the background TTL sweep
 * runs roughly once a minute, so release is "within ~60s of expiring", not
 * exact. See src/lib/claims.js for the reservation logic and
 * Campaign.claimed, the counter this keeps in sync.
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
  },
  { timestamps: true }
);

// One live claim per reviewer per campaign — re-opening the link renews the
// same claim (see lib/claims.js) instead of creating a second one.
ClaimSchema.index({ campaign: 1, reviewer: 1 }, { unique: true });
// TTL: document is removed once `expiresAt` is in the past.
ClaimSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Claim || mongoose.model("Claim", ClaimSchema);

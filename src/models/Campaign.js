import mongoose from "mongoose";

/**
 * A review-collection campaign funded from the owner's wallet. `budget` is
 * deducted from the wallet at creation; `targetReviews` = floor(budget / rate).
 * `collected` grows as verified (approved) reviews come in.
 *
 * `claimed` counts slots reserved-but-not-yet-decided: a reviewer opened the
 * review link (src/models/Claim.js) or has a submission still `pending`
 * verification. `collected + claimed` is the true number of spots spoken
 * for, and is what gates both new claims (src/lib/claims.js) and the
 * campaigns list shown to reviewers — not `collected` alone — so a campaign
 * can't be handed out to more reviewers than it has slots left, only for
 * most of them to find it already full after they've left a real review.
 */
const CampaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    name: { type: String, required: true, trim: true },
    platform: {
      type: String,
      enum: ["google", "trustpilot", "capterra", "amazon", "playstore"],
      default: "google",
    },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "GmbLocation", default: null },
    // The city this campaign's reviews should come from — captured at
    // creation (typed for a single campaign, auto-filled from the GMB
    // location for a batch). Reviewers only see campaigns whose city is
    // blank (open to anyone) or matches their own detected city — see
    // /(app)/reviewer/campaigns/page.jsx.
    city: { type: String, trim: true, default: "", index: true },
    targetUrl: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    budget: { type: Number, required: true, min: 0 },
    ratePerReview: { type: Number, required: true }, // ₹/review the BUSINESS pays into the budget
    targetReviews: { type: Number, required: true },
    collected: { type: Number, default: 0 },
    claimed: { type: Number, default: 0 },

    // Admin-only override of what a REVIEWER earns per verified review on
    // THIS campaign specifically — a completely different number from
    // `ratePerReview` above (what the business pays in). null = no override,
    // fall back to the global AppSettings.reviewerReward (lib/settings.js).
    // Never set by the business owner — see api/admin/campaigns/[id]/reward.
    reviewerReward: { type: Number, default: null, min: 0 },

    status: {
      type: String,
      enum: ["active", "paused", "completed", "draft"],
      default: "active",
      index: true,
    },

    // Optional "drip" pacing so reviews land on Google spread out over time
    // instead of all at once (a burst of reviews in a short window is exactly
    // the pattern Google's fake-engagement detection flags). null = no
    // limit, the default. The owner enters these as "N reviews every Y
    // day(s)" (pacingLimit=N, pacingWindowHours=Y*24), but they're enforced
    // as a single fixed gap = pacingWindowHours / pacingLimit hours between
    // reviews (counting both live claims and non-rejected submissions) — see
    // lib/pacing.js. The campaign stops appearing to reviewers whenever a
    // review landed more recently than that gap, until it elapses.
    pacingLimit: { type: Number, default: null, min: 1 },
    pacingWindowHours: { type: Number, default: null, min: 1 },

    // Optional pool of AI-drafted review texts, one reviewer per entry.
    // Generated (and editable) at creation time — see lib/aiReviewDrafts.js
    // and NewCampaignModal.jsx. When a reviewer claims a slot, claimSlot()
    // (lib/claims.js) atomically hands them one unassigned entry to copy
    // into their review; it's freed back to the pool if their claim expires
    // unused (see releaseExpiredClaims/releaseClaim). `assignedTo: null`
    // means still available.
    reviewDrafts: {
      type: [
        {
          text: { type: String, required: true, trim: true },
          // The local-search keyword this review was written around (see
          // lib/aiKeywords.js) — stored just for visibility on the campaigns
          // table; not read by any assignment/claim logic.
          keyword: { type: String, trim: true, default: "" },
          assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          assignedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },

    // Optional pool of images (uploaded to Cloudinary) for reviewers to
    // download and attach to the review they post — one reviewer per entry,
    // same assign-on-claim / release-on-expiry lifecycle as reviewDrafts
    // above. See lib/claims.js.
    reviewImages: {
      type: [
        {
          url: { type: String, required: true, trim: true },
          assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          assignedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);

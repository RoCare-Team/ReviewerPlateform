import mongoose from "mongoose";

/**
 * A review fetched from Google Business Profile for one location. Keyed by
 * (location, reviewId) so re-syncing upserts rather than duplicating.
 */
const GmbReviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    connection: { type: mongoose.Schema.Types.ObjectId, ref: "GmbConnection", index: true },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GmbLocation",
      required: true,
      index: true,
    },

    reviewId: { type: String, required: true },
    reviewerName: { type: String, default: "" },
    reviewerPhoto: { type: String, default: "" },
    starRating: { type: Number, default: 0 }, // 1..5
    comment: { type: String, default: "" },
    createTime: { type: Date },
    updateTime: { type: Date },
    reply: { type: String, default: "" },

    // Set when the reply above was posted by the AI auto-reply cron rather
    // than the business owner, so the UI can label it and the cron never
    // touches a review a human already replied to.
    autoReplied: { type: Boolean, default: false },
    autoRepliedAt: { type: Date },
  },
  { timestamps: true }
);

GmbReviewSchema.index({ location: 1, reviewId: 1 }, { unique: true });

export default mongoose.models.GmbReview || mongoose.model("GmbReview", GmbReviewSchema);

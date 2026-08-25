import mongoose from "mongoose";

/**
 * A review fetched from the Play Store (androidpublisher v3) for one tracked
 * app. Keyed by (app, reviewId) so re-syncing upserts rather than duplicating.
 */
const PlayStoreReviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    connection: { type: mongoose.Schema.Types.ObjectId, ref: "PlayStoreConnection", index: true },
    app: { type: mongoose.Schema.Types.ObjectId, ref: "PlayStoreApp", required: true, index: true },

    reviewId: { type: String, required: true },
    authorName: { type: String, default: "" },
    starRating: { type: Number, default: 0 }, // 1..5
    text: { type: String, default: "" },
    reviewerLanguage: { type: String, default: "" },
    device: { type: String, default: "" },
    appVersionName: { type: String, default: "" },
    thumbsUpCount: { type: Number, default: 0 },
    thumbsDownCount: { type: Number, default: 0 },
    lastModified: { type: Date },

    reply: { type: String, default: "" },
    replyLastModified: { type: Date },
  },
  { timestamps: true }
);

PlayStoreReviewSchema.index({ app: 1, reviewId: 1 }, { unique: true });

export default mongoose.models.PlayStoreReview ||
  mongoose.model("PlayStoreReview", PlayStoreReviewSchema);

import mongoose from "mongoose";

/**
 * A review-collection campaign funded from the owner's wallet. `budget` is
 * deducted from the wallet at creation; `targetReviews` = floor(budget / rate).
 * `collected` grows as verified reviews come in.
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
    targetUrl: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    budget: { type: Number, required: true, min: 0 },
    ratePerReview: { type: Number, required: true },
    targetReviews: { type: Number, required: true },
    collected: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["active", "paused", "completed", "draft"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);

import mongoose from "mongoose";

/**
 * Singleton app-wide settings — the ONE place platform pricing lives, editable by
 * admin. `reviewRate` is what a business pays per verified review; `reviewerReward`
 * is what a reviewer earns per verified submission. Enforced by a fixed `key`.
 */
const AppSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },
    reviewRate: { type: Number, default: 100, min: 1 }, // ₹ business pays per review
    reviewerReward: { type: Number, default: 50, min: 1 }, // ₹ reviewer earns per verified review
    minWithdrawal: { type: Number, default: 50, min: 1 }, // ₹ smallest amount a reviewer can request
    minTopup: { type: Number, default: 50, min: 1 }, // ₹ smallest amount a business can add to its wallet
    referralReward: { type: Number, default: 25, min: 1 }, // ₹ credited to a referrer per successful signup
    currency: { type: String, default: "INR" },
    // Hours a reviewer must wait after one submission before the next one is
    // accepted, platform-wide. Not pricing — it's the throughput control that
    // keeps a reviewer from posting a burst of reviews in one sitting, which
    // is the pattern Google's fake-engagement detection flags. 0 turns it off.
    // Enforced in lib/pacing.js#checkReviewerCooldown.
    reviewerCooldownHours: { type: Number, default: 4, min: 0, max: 168 },
  },
  { timestamps: true }
);

export default mongoose.models.AppSettings || mongoose.model("AppSettings", AppSettingsSchema);

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
    // How a reviewer's approved withdrawal actually gets paid:
    //   "manual"    — an admin transfers the money themselves (UPI/bank) and
    //                 records it here. Nothing is called out to any gateway.
    //   "razorpayx" — approving fires a real RazorpayX payout.
    // Defaults to MANUAL: RazorpayX has to be activated on the Razorpay
    // account before its payout endpoints even exist (they 404 otherwise),
    // and an approval that quietly failed used to auto-reject the request and
    // refund the reviewer — the money never moved, but the admin had already
    // decided it should. Manual is the honest default until X is live.
    payoutMode: { type: String, enum: ["manual", "razorpayx"], default: "manual" },
    // When a paid review is confirmed gone from Google, take the reward back
    // out of the reviewer's wallet automatically instead of queueing it for an
    // admin. See lib/reviewMonitor.js#runReviewRecheck for exactly which
    // findings qualify — notably NOT the ones where Google's own review count
    // says the listing has more reviews than its API handed us, which still go
    // to /admin/removed-reviews for a human.
    //
    // This is the one switch that stops money moving on its own. Kept in
    // settings rather than hardcoded so it can be turned off from /admin/pricing
    // the moment it misfires, without a deploy.
    autoReverseRemovedReviews: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.AppSettings || mongoose.model("AppSettings", AppSettingsSchema);

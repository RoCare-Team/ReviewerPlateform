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
    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

export default mongoose.models.AppSettings || mongoose.model("AppSettings", AppSettingsSchema);

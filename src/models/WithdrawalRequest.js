import mongoose from "mongoose";

/**
 * A reviewer's request to cash out their wallet balance. The amount is
 * deducted from the reviewer's wallet the moment the request is created (a
 * hold, same pattern as a business campaign's budget debit) — not on
 * approval — so a reviewer can never request more than they actually have,
 * even across several pending requests at once.
 *
 * Bank details are SNAPSHOTTED here from the User doc at request time, so a
 * reviewer editing their saved bank details later never rewrites where a
 * past (already-paid) request was sent to.
 *
 *   pending  → awaiting admin action, amount already held (deducted).
 *   approved → admin paid it out manually (outside the app — no gateway
 *              yet); the held amount stays deducted, nothing more happens.
 *   rejected → admin declined; the held amount is refunded back to the
 *              reviewer's wallet.
 */
const WithdrawalRequestSchema = new mongoose.Schema(
  {
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },

    accountHolderName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifsc: { type: String, required: true, trim: true, uppercase: true },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.WithdrawalRequest ||
  mongoose.model("WithdrawalRequest", WithdrawalRequestSchema);

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
 *   pending    → awaiting admin action, amount already held (deducted).
 *   processing → admin approved; a RazorpayX payout was created and is in
 *                flight (queued/pending/processing on Razorpay's side).
 *   approved   → the money has actually landed in the reviewer's bank account:
 *                either RazorpayX confirmed the payout, or (manual payout
 *                mode — see AppSettings.payoutMode) an admin transferred it
 *                by hand and recorded it here.
 *   rejected   → admin declined, OR the payout failed/reversed on Razorpay's
 *                side; either way the held amount is refunded to the wallet.
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
      enum: ["pending", "processing", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },

    // Internal-only diagnostic (never shown to the reviewer) — e.g. the real
    // Razorpay error when an automatic payout fails, so an admin can tell
    // "RazorpayX not activated" apart from "bad IFSC" without server logs.
    adminNote: { type: String, default: "" },

    // Manual payout trail (AppSettings.payoutMode === "manual"): the admin
    // moved the money themselves, so there is no gateway record to point at —
    // `paymentReference` is whatever they can point at instead (a UTR, a UPI
    // ref, a screenshot id). Optional: an approval is still valid without one.
    paidManually: { type: Boolean, default: false },
    paymentReference: { type: String, default: "", trim: true },

    // RazorpayX payout tracking — set when admin approval triggers an
    // automated payout instead of a manual bank transfer.
    razorpayContactId: { type: String, default: null },
    razorpayFundAccountId: { type: String, default: null },
    razorpayPayoutId: { type: String, default: null, index: true },
    razorpayPayoutStatus: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.WithdrawalRequest ||
  mongoose.model("WithdrawalRequest", WithdrawalRequestSchema);

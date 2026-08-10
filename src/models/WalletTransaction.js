import mongoose from "mongoose";

/**
 * Wallet ledger entry. `amount` is in whole rupees; positive for a credit
 * (top-up), negative for a debit (campaign spend). Balance on the User is the
 * running total. Top-ups are credited only after Razorpay confirms payment
 * capture (signature-verified on the client-return path, and again via
 * webhook as a backstop) — see api/business/wallet/{order,verify} and
 * api/webhooks/razorpay.
 */
const WalletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true }, // + credit, - debit
    type: { type: String, enum: ["topup", "spend", "refund", "reward", "withdrawal"], default: "topup" },
    note: { type: String, default: "" },

    // Set only when an ADMIN moved money on someone else's behalf. Null for a
    // self-service top-up or a system credit. Money that appears in a user's
    // balance without a trace of who put it there is not auditable.
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    balanceAfter: { type: Number, required: true },

    // Razorpay payment id for a top-up. Sparse-unique so the same captured
    // payment can never credit the wallet twice, even if both the client
    // verify call AND the webhook race to process it.
    razorpayPaymentId: { type: String, default: null, unique: true, sparse: true },
    razorpayOrderId: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", WalletTransactionSchema);

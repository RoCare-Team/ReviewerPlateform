import mongoose from "mongoose";

/**
 * Wallet ledger entry. `amount` is in whole rupees; positive for a credit
 * (top-up), negative for a debit (campaign spend). Balance on the User is the
 * running total. This is a MOCK top-up ledger — no real payment gateway is wired
 * yet; a Razorpay integration would create the credit only after payment capture.
 */
const WalletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true }, // + credit, - debit
    type: { type: String, enum: ["topup", "spend", "refund", "reward"], default: "topup" },
    note: { type: String, default: "" },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", WalletTransactionSchema);

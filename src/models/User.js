import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerified: { type: Date, default: null },

    // null for OAuth-only users. select:false so it never leaks
    // through a careless User.find() that gets serialised to JSON.
    passwordHash: { type: String, default: null, select: false },

    name: { type: String, trim: true },
    image: { type: String },

    // Optional self-service profile fields (editable by the user).
    phone: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, default: "" },

    // Wallet balance in whole rupees. Mutated only server-side via the wallet
    // API — never from a client payload directly.
    walletBalance: { type: Number, default: 0, min: 0 },

    // Reviewer payout bank details — saved once, reusable or editable on every
    // withdrawal request. Snapshotted onto each WithdrawalRequest too, so
    // editing these later never rewrites where a past payout was already sent.
    bankAccountHolder: { type: String, trim: true, default: "" },
    bankAccountNumber: { type: String, trim: true, default: "" },
    bankIfsc: { type: String, trim: true, uppercase: true, default: "" },

    // Denormalised from Role.key — no join on every request.
    // NEVER set from a client payload. Derive server-side from the route.
    role: {
      type: String,
      enum: ["reviewer", "business_owner", "admin"],
      required: true,
      index: true,
    },

    // pending → active once OTP verified (or immediately for Google/admin seed)
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
      index: true,
    },

    // admin only — see note at the bottom
    totpSecret: { type: String, default: null, select: false },
    totpEnabled: { type: Boolean, default: false },

    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
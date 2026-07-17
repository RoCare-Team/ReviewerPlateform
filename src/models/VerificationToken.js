import mongoose from "mongoose";

const VerificationTokenSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, lowercase: true, index: true },  // email

    tokenHash: { type: String, required: true, unique: true },   // ★ hash, not the token

    purpose: {
      type: String,
      enum: ["password_reset", "email_verify"],
      required: true,
    },

    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export default mongoose.models.VerificationToken ||
  mongoose.model("VerificationToken", VerificationTokenSchema);
import mongoose from "mongoose";

const OtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, index: true },

    codeHash: { type: String, required: true },   // ★ hash, never the raw 6 digits

    purpose: { type: String, enum: ["signup", "login"], required: true },

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },

    consumedAt: { type: Date, default: null },

    // TTL index — Mongo deletes the doc at expiresAt. No cleanup cron.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

OtpSchema.index({ email: 1, purpose: 1, consumedAt: 1 });

export default mongoose.models.Otp || mongoose.model("Otp", OtpSchema);
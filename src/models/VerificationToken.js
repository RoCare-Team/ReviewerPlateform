import mongoose from "mongoose";

const VerificationTokenSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, lowercase: true, index: true },  // email or phone

    tokenHash: { type: String, required: true, unique: true },   // ★ hash, not the token

    purpose: {
      type: String,
      // phone_login: the phone+OTP session bridge — see lib/auth/phoneAuth.js
      // and providers/phoneOtp.js. Same pattern as post_verify_login, just
      // identifier is a phone number instead of an email.
      // phone_verified: OTP passed but no account exists yet for this phone —
      // bridges to the name step, then to account creation (phoneAuth.js).
      enum: ["password_reset", "email_verify", "post_verify_login", "phone_login", "phone_verified"],
      required: true,
    },

    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export default mongoose.models.VerificationToken ||
  mongoose.model("VerificationToken", VerificationTokenSchema);
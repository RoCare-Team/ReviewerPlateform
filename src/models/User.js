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
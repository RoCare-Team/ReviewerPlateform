import mongoose from "mongoose";

/**
 * One connected Google account for Play Store (androidpublisher) reviews.
 *
 * A single business user may connect MULTIPLE Google accounts — each is a
 * separate PlayStoreConnection, keyed by (user, googleSub). This is the same
 * shape as GmbConnection but entirely separate: a different OAuth client
 * (PLAYSTORE_CLIENT_ID/SECRET) and scope (androidpublisher), because the
 * connected account only sees reviews for apps IT owns/has access to in
 * Play Console — never arbitrary third-party apps. See lib/playstore.js.
 *
 * Tokens are select:false so a careless find() can't serialise them.
 */
const PlayStoreConnectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail: { type: String, lowercase: true, trim: true },

    googleEmail: { type: String, required: true, lowercase: true, trim: true },
    googleSub: { type: String, required: true },

    accessToken: { type: String, select: false },
    refreshToken: { type: String, select: false },
    tokenExpiresAt: { type: Date },
    scope: { type: String },

    status: {
      type: String,
      enum: ["active", "revoked", "error"],
      default: "active",
      index: true,
    },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

// A user can connect many Google accounts, but not the same one twice.
PlayStoreConnectionSchema.index({ user: 1, googleSub: 1 }, { unique: true });

export default mongoose.models.PlayStoreConnection ||
  mongoose.model("PlayStoreConnection", PlayStoreConnectionSchema);

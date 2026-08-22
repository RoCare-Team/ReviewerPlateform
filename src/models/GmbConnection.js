import mongoose from "mongoose";

/**
 * One connected Google Business Profile (GMB) account for a user.
 *
 * A single user (business owner) may connect MULTIPLE Google accounts — each is
 * a separate GmbConnection, keyed by (user, googleSub). `user` references the
 * User _id; `userEmail` is the user's own login email (denormalised reference);
 * `googleEmail`/`googleSub` identify the connected Google account.
 *
 * Tokens are select:false so a careless find() can't serialise them. This is the
 * GBP connection ONLY — entirely separate from sign-in-with-Google (see
 * src/lib/auth/providers/google.js).
 */
const GmbConnectionSchema = new mongoose.Schema(
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

    // When on, the AI auto-reply cron (src/app/api/cron/gmb-auto-reply) posts
    // a generated reply to any new review on this connection's locations that
    // has no reply yet. Off by default — replying is opt-in per connection.
    autoReplyEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A user can connect many Google accounts, but not the same one twice.
GmbConnectionSchema.index({ user: 1, googleSub: 1 }, { unique: true });

export default mongoose.models.GmbConnection ||
  mongoose.model("GmbConnection", GmbConnectionSchema);

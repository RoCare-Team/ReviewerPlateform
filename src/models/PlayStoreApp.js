import mongoose from "mongoose";

/**
 * One Android app (by package name) tracked under a PlayStoreConnection. The
 * user types the package name in — unlike GMB locations, the androidpublisher
 * API has no "list my apps" endpoint, so there's nothing to auto-discover.
 * Google itself validates ownership: the very first sync call 403s if the
 * connected account has no Play Console access to this package.
 */
const PlayStoreAppSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    connection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlayStoreConnection",
      required: true,
      index: true,
    },
    googleEmail: { type: String, lowercase: true, trim: true },

    packageName: { type: String, required: true, trim: true }, // e.g. "com.example.app"
    label: { type: String, default: "" }, // user-facing name, defaults to packageName

    reviewCount: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

PlayStoreAppSchema.index({ connection: 1, packageName: 1 }, { unique: true });

export default mongoose.models.PlayStoreApp || mongoose.model("PlayStoreApp", PlayStoreAppSchema);

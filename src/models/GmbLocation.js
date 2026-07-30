import mongoose from "mongoose";

/**
 * A business location under a GmbConnection. One connected Google account can own
 * MULTIPLE locations, so each is its own document, keyed by (connection,
 * locationName). `accountName` is the GMB account resource ("accounts/123") and
 * `locationName` is the location resource ("locations/456") — both are needed to
 * build the v4 Reviews API path.
 */
const GmbLocationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    connection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GmbConnection",
      required: true,
      index: true,
    },
    googleEmail: { type: String, lowercase: true, trim: true },

    accountName: { type: String, required: true }, // "accounts/123"
    locationName: { type: String, required: true }, // "locations/456"

    title: { type: String, default: "" },
    storeCode: { type: String, default: "" },
    address: { type: String, default: "" },

    reviewCount: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

GmbLocationSchema.index({ connection: 1, locationName: 1 }, { unique: true });

export default mongoose.models.GmbLocation ||
  mongoose.model("GmbLocation", GmbLocationSchema);

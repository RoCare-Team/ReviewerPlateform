import mongoose from "mongoose";

const AccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, required: true },              // "google"
    providerAccountId: { type: String, required: true },     // Google's sub
    type: { type: String, default: "oauth" },

    access_token: { type: String, select: false },
    refresh_token: { type: String, select: false },
    expires_at: { type: Number },
    scope: { type: String },                                 // "openid email profile"
  },
  { timestamps: true }
);

AccountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });

export default mongoose.models.Account || mongoose.model("Account", AccountSchema);
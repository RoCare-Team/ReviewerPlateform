import mongoose from "mongoose";

/**
 * A reviewer's participation in a campaign: they left a review and uploaded a
 * screenshot as proof. Admin verifies it; on approval the reviewer's wallet is
 * credited the reward and the campaign's collected count grows.
 *
 * One submission per (campaign, reviewer) — a reviewer can't farm the same
 * campaign repeatedly.
 */
const SubmissionSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    screenshotUrl: { type: String, required: true },
    note: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rewardAmount: { type: Number, default: 0 },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SubmissionSchema.index({ campaign: 1, reviewer: 1 }, { unique: true });

export default mongoose.models.Submission || mongoose.model("Submission", SubmissionSchema);

import Submission from "../models/Submission";
import User from "../models/User";
import Campaign from "../models/Campaign";
import WalletTransaction from "../models/WalletTransaction";

/**
 * Shared submission verification effects — used by both the automatic AI verifier
 * (reviewer submissions route) and manual admin verification. The status guard
 * ({ status: "pending" }) makes approval idempotent: a submission can be paid at
 * most once, whichever path gets there first.
 */

/**
 * Approve a submission: claim one collected slot on the campaign, credit the
 * reviewer's wallet, log the reward. Returns:
 *  - "approved"       — applied normally.
 *  - "already_processed" — this submission wasn't in an approvable status
 *                        (already approved, or not in `allowFrom`) — idempotent no-op.
 *  - "campaign_full"  — the campaign already hit its target (a concurrent approval won
 *                        the last slot); the submission is rejected instead, no reward.
 *
 * `allowFrom` gates which starting status is acceptable. Defaults to only
 * "pending" — the normal AI/first-pass path. An admin overriding an earlier
 * REJECTED verdict (their call only; never the AI's) passes
 * `allowFrom: ["pending", "rejected"]` explicitly — see the admin submissions
 * route. An already-approved submission is never in `allowFrom`, so this can
 * never pay a reviewer twice for the same submission.
 *
 * The campaign slot is claimed with an atomic conditional increment
 * (collected < targetReviews) BEFORE any money moves, so two submissions
 * racing to fill the last slot can never both succeed — whichever loses the
 * atomic update gets rejected here rather than overshooting the target.
 */
export async function approveSubmission(submissionId, reward, { verifiedBy = "", reviewedBy = null, allowFrom = ["pending"] } = {}) {
  const current = await Submission.findOne({ _id: submissionId, status: { $in: allowFrom } }).select("campaign reviewer");
  if (!current) return "already_processed";

  const campaign = await Campaign.findOneAndUpdate(
    { _id: current.campaign, $expr: { $lt: ["$collected", "$targetReviews"] } },
    { $inc: { collected: 1 } },
    { returnDocument: "after" }
  );

  if (!campaign) {
    await Submission.updateOne(
      { _id: submissionId, status: { $in: allowFrom } },
      {
        $set: {
          status: "rejected",
          rejectionReason: "Campaign already reached its review target.",
          verifiedBy,
          reviewedBy,
          reviewedAt: new Date(),
        },
      }
    );
    return "campaign_full";
  }

  const sub = await Submission.findOneAndUpdate(
    { _id: submissionId, status: { $in: allowFrom } },
    // rejectionReason cleared: a submission approved on override no longer
    // carries the reason it was once rejected for.
    { $set: { status: "approved", rewardAmount: reward, rejectionReason: "", verifiedBy, reviewedBy, reviewedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!sub) {
    // Lost a race with another verification path after claiming the slot —
    // give the slot back so the target stays accurate.
    await Campaign.updateOne({ _id: campaign._id }, { $inc: { collected: -1 } });
    return "already_processed";
  }

  const reviewer = await User.findByIdAndUpdate(
    sub.reviewer,
    { $inc: { walletBalance: reward } },
    { returnDocument: "after" }
  ).select("walletBalance");

  await WalletTransaction.create({
    user: sub.reviewer,
    amount: reward,
    type: "reward",
    note: "Verified review reward",
    balanceAfter: reviewer?.walletBalance ?? reward,
  });

  if (campaign.collected >= campaign.targetReviews && campaign.status === "active") {
    await Campaign.updateOne({ _id: campaign._id }, { $set: { status: "completed" } });
  }
  return "approved";
}

/** Reject a pending submission with a reason. Returns true if it applied. */
export async function rejectSubmission(submissionId, reason, { verifiedBy = "", reviewedBy = null } = {}) {
  const sub = await Submission.findOneAndUpdate(
    { _id: submissionId, status: "pending" },
    { $set: { status: "rejected", rejectionReason: reason, verifiedBy, reviewedBy, reviewedAt: new Date() } },
    { returnDocument: "after" }
  );
  return Boolean(sub);
}

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
 * reviewer's wallet, log the reward. Returns { outcome, reward }:
 *  - outcome "approved"       — applied normally. `reward` is what was actually paid.
 *  - outcome "already_processed" — this submission wasn't in an approvable status
 *                        (already approved, or not in `allowFrom`) — idempotent no-op.
 *  - outcome "campaign_full"  — the campaign already hit its target (a concurrent approval won
 *                        the last slot); the submission is rejected instead, no reward.
 *
 * `fallbackReward` is the platform-wide default (AppSettings.reviewerReward,
 * lib/settings.js) — used ONLY when the campaign has no per-campaign
 * override. Campaign.reviewerReward (admin-only, set via
 * api/admin/campaigns/[id]/reward) always wins when present: an admin can
 * pay a specific campaign's reviewers more or less than the global rate,
 * e.g. to incentivize a hard-to-fill campaign. A business owner never sets
 * this — it's a payout policy lever, not a budget one.
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
export async function approveSubmission(submissionId, fallbackReward, { verifiedBy = "", reviewedBy = null, allowFrom = ["pending"] } = {}) {
  const current = await Submission.findOne({ _id: submissionId, status: { $in: allowFrom } }).select("campaign reviewer");
  if (!current) return { outcome: "already_processed", reward: 0 };

  // collected+1 and claimed-1 in the same atomic update: this submission's
  // reserved slot (claimed) is settling into a real, approved one (collected).
  const campaign = await Campaign.findOneAndUpdate(
    { _id: current.campaign, $expr: { $lt: ["$collected", "$targetReviews"] } },
    { $inc: { collected: 1, claimed: -1 } },
    { returnDocument: "after" }
  );

  // Safety clamp: a submission approved without ever going through the claim
  // flow (e.g. data predating this feature, or an admin override) would push
  // `claimed` negative here — floor it at 0 rather than let it skew capacity
  // checks for every other submission on this campaign.
  if (campaign && campaign.claimed < 0) {
    await Campaign.updateOne({ _id: campaign._id }, { $set: { claimed: 0 } });
    campaign.claimed = 0;
  }

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
    // This submission's slot reservation is now settled (as a rejection) —
    // release it back to the pool.
    await Campaign.updateOne({ _id: current.campaign, claimed: { $gte: 1 } }, { $inc: { claimed: -1 } });
    return { outcome: "campaign_full", reward: 0 };
  }

  // Per-campaign override wins over the global default whenever it's set.
  const reward = campaign.reviewerReward ?? fallbackReward;

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
    return { outcome: "already_processed", reward: 0 };
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
  return { outcome: "approved", reward };
}

/** Reject a pending submission with a reason. Returns true if it applied. */
export async function rejectSubmission(submissionId, reason, { verifiedBy = "", reviewedBy = null } = {}) {
  const sub = await Submission.findOneAndUpdate(
    { _id: submissionId, status: "pending" },
    { $set: { status: "rejected", rejectionReason: reason, verifiedBy, reviewedBy, reviewedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (sub) {
    // Settled as a rejection — release its reserved slot back to the pool.
    await Campaign.updateOne({ _id: sub.campaign, claimed: { $gte: 1 } }, { $inc: { claimed: -1 } });
  }
  return Boolean(sub);
}

/**
 * Un-verify a previously APPROVED submission (AI or admin) — admin-only, the
 * mirror image of `approveSubmission`. Claws back the reward from the
 * reviewer's wallet, gives the campaign slot back, and flips the submission
 * to "rejected" with the given reason so it's clear it was reversed, not
 * newly rejected. The status guard ({ status: "approved" }) makes this
 * idempotent — an already-unverified (rejected/pending) submission can't be
 * clawed back twice.
 *
 * Returns "unverified" | "already_processed" (not approved) | "insufficient_balance"
 * (reviewer's wallet can't cover the clawback — e.g. already withdrawn; the
 * balance goes negative rather than silently failing, so the shortfall stays
 * visible and collectible, but the caller is told so it can be surfaced).
 */
export async function unverifySubmission(submissionId, reason, { reviewedBy = null } = {}) {
  const current = await Submission.findOne({ _id: submissionId, status: "approved" }).select(
    "campaign reviewer rewardAmount"
  );
  if (!current) return "already_processed";

  const sub = await Submission.findOneAndUpdate(
    { _id: submissionId, status: "approved" },
    {
      $set: {
        status: "rejected",
        rejectionReason: reason,
        verifiedBy: "admin",
        reviewedBy,
        reviewedAt: new Date(),
        rewardAmount: 0,
      },
    },
    { returnDocument: "after" }
  );
  if (!sub) return "already_processed";

  const reward = current.rewardAmount || 0;

  await Campaign.updateOne(
    { _id: current.campaign, collected: { $gt: 0 } },
    { $inc: { collected: -1 }, $set: { status: "active" } }
  );

  const reviewer = await User.findByIdAndUpdate(
    current.reviewer,
    { $inc: { walletBalance: -reward } },
    { returnDocument: "after" }
  ).select("walletBalance");

  await WalletTransaction.create({
    user: current.reviewer,
    amount: -reward,
    type: "refund",
    note: `Reward reversed — submission un-verified: ${reason}`,
    by: reviewedBy,
    balanceAfter: reviewer?.walletBalance ?? -reward,
  });

  return (reviewer?.walletBalance ?? 0) < 0 ? "insufficient_balance" : "unverified";
}

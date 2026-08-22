import dbConnect from "../../../../../lib/db";
import Campaign from "../../../../../models/Campaign";
import Claim from "../../../../../models/Claim";
import Submission from "../../../../../models/Submission";
import User from "../../../../../models/User";
import WalletTransaction from "../../../../../models/WalletTransaction";
import { apiRequireAdmin } from "../../../../../lib/auth/guards";

/**
 * Admin-only campaign delete. Irreversible — the campaign disappears from
 * every dashboard (business, reviewer, admin) the instant this returns.
 *
 * Two things happen alongside the delete itself, both best-effort but
 * deliberate:
 *  1. The campaign's unspent budget (budget minus whatever's already been
 *     collected, at its own rate) is refunded to the owner's wallet — it was
 *     debited whole at creation time (see api/business/campaigns/route.js),
 *     and none of the never-going-to-happen remaining reviews should cost
 *     the business anything.
 *  2. Any live Claims (open, unexpired slot reservations) are released —
 *     they'd otherwise dangle, pointing at a campaign that no longer exists.
 *
 * Already-DECIDED Submissions are deliberately left alone — they're the
 * historical record of real participation and real reviewer payouts, and
 * stay queryable (reviewer submission history, business analytics) even
 * after the campaign itself is gone. A still-PENDING one is a different
 * matter and blocks the delete entirely: it's mid-verification (the AI
 * screenshot check may have passed but the Google cross-check is still
 * waiting for the review to show up — see api/cron/gmb-recheck), and both
 * that cron and a manual admin approval need a live Campaign document to
 * settle it. Deleting the campaign out from under a pending submission
 * orphans it — nothing can ever verify or pay it again, silently stuck
 * forever. Resolve (approve/reject) every pending submission first.
 */
export async function DELETE(request, { params }) {
  const { user: admin, response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  await dbConnect();

  const campaign = await Campaign.findById(id);
  if (!campaign) {
    return Response.json({ error: "Campaign not found." }, { status: 404 });
  }

  const pendingCount = await Submission.countDocuments({ campaign: campaign._id, status: "pending" });
  if (pendingCount > 0) {
    return Response.json(
      {
        error: `This campaign has ${pendingCount} submission${pendingCount === 1 ? "" : "s"} still awaiting verification — approve or reject ${pendingCount === 1 ? "it" : "them"} first.`,
      },
      { status: 409 }
    );
  }

  const spent = (campaign.collected ?? 0) * (campaign.ratePerReview ?? 0);
  const refund = Math.max(0, (campaign.budget ?? 0) - spent);

  if (refund > 0) {
    const credited = await User.findOneAndUpdate(
      { _id: campaign.user },
      { $inc: { walletBalance: refund } },
      { returnDocument: "after" }
    ).select("walletBalance");

    // The owner account itself could be gone (rare, but not this route's
    // problem to solve) — don't let a missing wallet block the delete.
    if (credited) {
      await WalletTransaction.create({
        user: campaign.user,
        amount: refund,
        type: "refund",
        note: `Campaign deleted by admin: ${campaign.name}`,
        by: admin.id,
        balanceAfter: credited.walletBalance,
      });
    }
  }

  await Claim.deleteMany({ campaign: campaign._id });
  await Campaign.deleteOne({ _id: campaign._id });

  return Response.json({ ok: true, refunded: refund });
}

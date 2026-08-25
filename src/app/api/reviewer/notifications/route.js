import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import WithdrawalRequest from "../../../../models/WithdrawalRequest";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * The reviewer's activity feed.
 *
 * There is no Notification collection in this product, and adding one would
 * mean writing a row at every place a status changes — easy to forget, and a
 * second source of truth that can disagree with the real one. So the feed is
 * DERIVED from what actually happened: submissions that were approved or
 * rejected, submissions still in verification, and withdrawal outcomes.
 *
 * That means it's always accurate and needs no backfill, at the cost of not
 * having a per-notification read flag — the app tracks "seen" locally.
 * If you later want true push notifications, this is the shape to emit.
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("feedback:submit");
  if (response) return response;

  await dbConnect();

  const [submissions, withdrawals] = await Promise.all([
    Submission.find({ reviewer: user.id }).sort({ updatedAt: -1 }).limit(30).lean(),
    WithdrawalRequest.find({ reviewer: user.id }).sort({ updatedAt: -1 }).limit(10).lean(),
  ]);

  const campaigns = await Campaign.find({
    _id: { $in: submissions.map((s) => s.campaign) },
  })
    .select("name businessName")
    .lean();
  const nameById = new Map(
    campaigns.map((c) => [String(c._id), c.businessName || c.name])
  );

  const items = [];

  for (const s of submissions) {
    const label = nameById.get(String(s.campaign)) ?? "your campaign";

    if (s.status === "approved") {
      items.push({
        id: `sub-${s._id}-approved`,
        kind: "review_approved",
        title: "Your review is approved!",
        body: `${label} • ₹${s.rewardAmount ?? 0} added to your wallet`,
        createdAt: s.reviewedAt ?? s.updatedAt,
      });
    } else if (s.status === "rejected") {
      items.push({
        id: `sub-${s._id}-rejected`,
        kind: "review_rejected",
        title: "Your review wasn't approved",
        body: s.rejectionReason || `${label} • tap to see why and resubmit`,
        createdAt: s.reviewedAt ?? s.updatedAt,
      });
    } else {
      items.push({
        id: `sub-${s._id}-pending`,
        kind: "under_verification",
        title: "Review under verification",
        body: `${label} • we'll update you as soon as it's checked`,
        createdAt: s.createdAt,
      });
    }
  }

  for (const w of withdrawals) {
    if (w.status === "approved") {
      items.push({
        id: `wdr-${w._id}-paid`,
        kind: "payout",
        title: "Withdrawal paid",
        body: `₹${w.amount} has landed in your bank account`,
        createdAt: w.reviewedAt ?? w.updatedAt,
      });
    } else if (w.status === "rejected") {
      items.push({
        id: `wdr-${w._id}-rejected`,
        kind: "payout",
        title: "Withdrawal declined",
        body: w.rejectionReason || `₹${w.amount} has been refunded to your wallet`,
        createdAt: w.reviewedAt ?? w.updatedAt,
      });
    }
  }

  items.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));

  return Response.json({ notifications: items.slice(0, 40) });
}

/**
 * Marking read is a no-op server-side, because the feed above is derived
 * rather than stored — there's no row to flip. The app clears its own badge
 * locally. Kept so the client's call doesn't 404.
 */
export async function POST() {
  const { response } = await apiRequirePermission("feedback:submit");
  if (response) return response;
  return Response.json({ ok: true });
}

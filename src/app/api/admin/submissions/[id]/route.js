import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import Submission from "../../../../../models/Submission";
import Campaign from "../../../../../models/Campaign";
import User from "../../../../../models/User";
import WalletTransaction from "../../../../../models/WalletTransaction";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { ROLES } from "../../../../../lib/auth/roles";
import { getSettings } from "../../../../../lib/settings";

/**
 * Admin verifies a reviewer's submission.
 *   approve → credit the reviewer's wallet with the global reward, bump the
 *             campaign's collected count (complete it if the target is hit).
 *   reject  → mark rejected with a reason. No reward.
 *
 * The status guard ({ status: "pending" }) makes approve idempotent — a second
 * click matches nothing, so a reviewer can never be double-paid.
 */
const schema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(300).optional().default(""),
  })
  .strict();

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN || user.status !== "active") {
    return { user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function PATCH(request, { params }) {
  const { user: admin, response } = await requireAdminApi();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  await dbConnect();

  if (parsed.data.action === "reject") {
    const rejected = await Submission.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "rejected", rejectionReason: parsed.data.reason, reviewedBy: admin.id, reviewedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!rejected) return Response.json({ error: "Submission not found or already reviewed." }, { status: 404 });
    return Response.json({ ok: true });
  }

  // Approve. Claim the submission first (atomic) so it can't be paid twice.
  const settings = await getSettings();
  const reward = settings.reviewerReward;

  const sub = await Submission.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "approved", rewardAmount: reward, reviewedBy: admin.id, reviewedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!sub) return Response.json({ error: "Submission not found or already reviewed." }, { status: 404 });

  // Credit the reviewer's wallet and record the ledger entry.
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

  // Grow the campaign's collected count; complete it if the target is reached.
  const campaign = await Campaign.findByIdAndUpdate(
    sub.campaign,
    { $inc: { collected: 1 } },
    { returnDocument: "after" }
  );
  if (campaign && campaign.collected >= campaign.targetReviews && campaign.status === "active") {
    await Campaign.updateOne({ _id: campaign._id }, { $set: { status: "completed" } });
  }

  return Response.json({ ok: true });
}

import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * Submissions made against this owner's campaigns — the data behind
 * src/app/(app)/business/feedback/page.jsx.
 *
 * READ-ONLY by design. Approving or rejecting a submission is an ADMIN action
 * (/api/admin/submissions/[id]); a business must never be able to approve the
 * reviews it is paying for. This endpoint is the audit trail, nothing more.
 *
 * What is NOT returned, deliberately:
 *   - the reviewer's phone number or user id — the business gets a display
 *     name only, so a campaign can't be used to harvest contact details;
 *   - `screenshotHash` and `gmbReviewId`, which are internal fraud-detection
 *     signals.
 * The AI verdict IS returned, because the owner is entitled to know why a
 * review they paid for was or wasn't accepted.
 */
export async function GET(request) {
  const { user, response } = await apiRequirePermission("campaign:read");
  if (response) return response;

  await dbConnect();

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const submissions = await Submission.find({
    business: user.id,
    ...(status ? { status } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const [campaigns, reviewers] = await Promise.all([
    Campaign.find({ _id: { $in: submissions.map((s) => s.campaign) } })
      .select("name businessName")
      .lean(),
    User.find({ _id: { $in: submissions.map((s) => s.reviewer) } })
      .select("name")
      .lean(),
  ]);

  const campaignById = new Map(campaigns.map((c) => [String(c._id), c]));
  const reviewerById = new Map(reviewers.map((r) => [String(r._id), r.name]));

  return Response.json({
    submissions: submissions.map((s) => {
      const campaign = campaignById.get(String(s.campaign));
      return {
        id: String(s._id),
        campaignName: campaign?.name ?? campaign?.businessName ?? "Campaign",
        reviewerName: reviewerById.get(String(s.reviewer)) ?? "Reviewer",
        status: s.status,
        note: s.note ?? "",
        screenshotUrl: s.screenshotUrl ?? "",
        rewardAmount: s.rewardAmount ?? 0,
        rejectionReason: s.rejectionReason ?? "",
        aiDecision: s.aiDecision ?? "",
        aiConfidence: s.aiConfidence ?? 0,
        aiReason: s.aiReason ?? "",
        gmbChecked: s.gmbChecked ?? false,
        gmbMatched: s.gmbMatched ?? false,
        submittedAt: s.createdAt,
        reviewedAt: s.reviewedAt,
      };
    }),
  });
}

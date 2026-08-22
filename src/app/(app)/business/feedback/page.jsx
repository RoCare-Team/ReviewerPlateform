import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import SubmissionFeed from "../../../../components/business/SubmissionFeed";

export const metadata = { title: "Reviewer submissions · RapportLook Business" };

const PLATFORM_LABEL = {
  google: "Google",
  trustpilot: "Trustpilot",
  capterra: "Capterra",
  amazon: "Amazon",
  playstore: "Play Store",
};

export default async function BusinessFeedbackPage() {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();

  // Scoped to this owner on BOTH sides: campaigns by `user`, submissions by
  // `business`. A submission can only ever surface here for its own business.
  const [campaigns, submissions] = await Promise.all([
    Campaign.find({ user: user.id })
      .select("name platform status targetUrl targetReviews collected")
      .sort({ createdAt: -1 })
      .lean(),
    Submission.find({ business: user.id }).sort({ createdAt: -1 }).lean(),
  ]);

  // Reviewer names in one query rather than a populate per submission.
  // Name only — the business has no need for reviewer email addresses here.
  const reviewers = await User.find({ _id: { $in: submissions.map((s) => s.reviewer) } })
    .select("name")
    .lean();
  const reviewerName = new Map(reviewers.map((r) => [String(r._id), r.name]));

  // campaignId → submissions, newest first (the find() sort carries through).
  const byCampaign = new Map();
  for (const s of submissions) {
    const id = String(s.campaign);
    if (!byCampaign.has(id)) byCampaign.set(id, []);
    byCampaign.get(id).push(s);
  }

  // Serialize for the client component (plain objects, string ids, ISO dates).
  const campaignViews = campaigns.map((c) => {
    const id = String(c._id);
    const subs = byCampaign.get(id) ?? [];
    return {
      id,
      name: c.name,
      status: c.status,
      platformLabel: PLATFORM_LABEL[c.platform] ?? c.platform,
      targetReviews: c.targetReviews ?? 0,
      collected: c.collected ?? 0,
      subs: subs.map((s) => ({
        id: String(s._id),
        reviewerName: reviewerName.get(String(s.reviewer)) || "",
        screenshotUrl: s.screenshotUrl,
        note: s.note,
        status: s.status,
        rejectionReason: s.rejectionReason,
        createdAt: s.createdAt.toISOString(),
        reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
      })),
    };
  });

  return (
    <div>
      <SubmissionFeed campaigns={campaignViews} />
    </div>
  );
}

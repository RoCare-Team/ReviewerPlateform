import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import Campaign from "../../../../models/Campaign";
import Submission from "../../../../models/Submission";
import { getSettings, inr } from "../../../../lib/settings";
import CampaignParticipation from "../../../../components/reviewer/CampaignParticipation";

export const metadata = { title: "Available campaigns · ReviewHub" };

export default async function ReviewerCampaignsPage() {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const settings = await getSettings();

  const [mySubs, openCampaigns] = await Promise.all([
    Submission.find({ reviewer: user.id }).select("campaign status").lean(),
    Campaign.find({ status: "active" }).sort({ createdAt: -1 }).lean(),
  ]);

  // campaignId → this reviewer's status on it. Only an approved or still-
  // pending submission makes a campaign unavailable — a rejected one doesn't,
  // so it keeps showing up here for a resubmission with a new screenshot.
  const statusByCampaign = new Map(mySubs.map((s) => [String(s.campaign), s.status]));

  const available = openCampaigns
    .filter((c) => {
      if ((c.collected ?? 0) >= c.targetReviews) return false;
      const status = statusByCampaign.get(String(c._id));
      return !status || status === "rejected";
    })
    .map((c) => ({
      id: String(c._id),
      name: c.name,
      platform: c.platform,
      notes: c.notes,
      targetUrl: c.targetUrl,
      collected: c.collected ?? 0,
      target: c.targetReviews,
      remaining: c.targetReviews - (c.collected ?? 0),
      previouslyRejected: statusByCampaign.get(String(c._id)) === "rejected",
    }));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Available campaigns</h1>
      <p className="mt-2 text-secondary">
        Earn {inr(settings.reviewerReward)} for every verified review. Rewards are for verified
        participation, never for positive ratings.
      </p>

      <div className="mt-8">
        <CampaignParticipation campaigns={available} reward={settings.reviewerReward} />
      </div>
    </div>
  );
}

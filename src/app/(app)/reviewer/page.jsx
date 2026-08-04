import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import Campaign from "../../../models/Campaign";
import Submission from "../../../models/Submission";
import { getSettings, inr } from "../../../lib/settings";
import CampaignParticipation from "../../../components/reviewer/CampaignParticipation";
import OverviewStats from "../../../components/reviewer/OverviewStats";

export const metadata = { title: "Your dashboard · ReviewHub" };

export default async function ReviewerHomePage() {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const settings = await getSettings();

  const [me, mySubs] = await Promise.all([
    User.findById(user.id).select("walletBalance").lean(),
    Submission.find({ reviewer: user.id }).select("campaign status").lean(),
  ]);

  const submittedIds = new Set(mySubs.map((s) => String(s.campaign)));
  const approved = mySubs.filter((s) => s.status === "approved").length;
  const pending = mySubs.filter((s) => s.status === "pending").length;
  const rejected = mySubs.filter((s) => s.status === "rejected").length;

  // Active campaigns not yet full and not already submitted by this reviewer.
  const openCampaigns = await Campaign.find({ status: "active" })
    .sort({ createdAt: -1 })
    .lean();
  const available = openCampaigns
    .filter((c) => (c.collected ?? 0) < c.targetReviews && !submittedIds.has(String(c._id)))
    .map((c) => ({
      id: String(c._id),
      name: c.name,
      platform: c.platform,
      notes: c.notes,
      targetUrl: c.targetUrl,
      collected: c.collected ?? 0,
      target: c.targetReviews,
      remaining: c.targetReviews - (c.collected ?? 0),
    }));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        Hi{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 text-secondary">
        Earn {inr(settings.reviewerReward)} for every verified review. Rewards are for verified
        participation, never for positive ratings.
      </p>

      {/* Overview: stat tiles + submission status breakdown */}
      <div className="mt-8">
        <OverviewStats
          walletBalance={me?.walletBalance ?? 0}
          formattedWallet={inr(me?.walletBalance ?? 0)}
          approved={approved}
          pending={pending}
          rejected={rejected}
        />
      </div>

      {/* Available campaigns */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">Available campaigns</h2>
          <Link href="/reviewer/feedback" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            My submissions
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-4">
          <CampaignParticipation campaigns={available} reward={settings.reviewerReward} />
        </div>
      </div>
    </div>
  );
}

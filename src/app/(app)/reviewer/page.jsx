import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import Campaign from "../../../models/Campaign";
import Submission from "../../../models/Submission";
import { getSettings, inr } from "../../../lib/settings";
import OverviewStats from "../../../components/reviewer/OverviewStats";

export const metadata = { title: "Your dashboard · RapportLook" };

export default async function ReviewerHomePage() {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const settings = await getSettings();

  const [me, mySubs] = await Promise.all([
    User.findById(user.id).select("walletBalance").lean(),
    Submission.find({ reviewer: user.id }).select("campaign status").lean(),
  ]);

  const approved = mySubs.filter((s) => s.status === "approved").length;
  const pending = mySubs.filter((s) => s.status === "pending").length;
  const rejected = mySubs.filter((s) => s.status === "rejected").length;

  // Same "is it actually available" rule as /reviewer/campaigns: a rejected
  // submission doesn't take a campaign off this count — it's still open for
  // a resubmission.
  const statusByCampaign = new Map(mySubs.map((s) => [String(s.campaign), s.status]));
  const openCampaigns = await Campaign.find({ status: "active" }).select("collected targetReviews").lean();
  const availableCount = openCampaigns.filter((c) => {
    if ((c.collected ?? 0) >= c.targetReviews) return false;
    const status = statusByCampaign.get(String(c._id));
    return !status || status === "rejected";
  }).length;

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

      {/* Available campaigns — its own dedicated page now, this is just the entry point */}
      <Link
        href="/reviewer/campaigns"
        className="group mt-10 flex items-center justify-between gap-4 rounded-card border border-accent-border bg-accent-subtle p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-on-brand transition-transform duration-300 group-hover:scale-110">
            <Megaphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-primary">Available campaigns</h2>
            <p className="text-sm text-secondary">
              {availableCount > 0
                ? `${availableCount} campaign${availableCount === 1 ? "" : "s"} you can join right now.`
                : "No campaigns available right now — check back soon."}
            </p>
          </div>
        </div>
        <ArrowRight
          className="h-5 w-5 shrink-0 text-accent transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}

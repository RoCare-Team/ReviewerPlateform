import { CheckCircle2, Clock, MessageSquare, XCircle } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import { inr } from "../../../../lib/settings";
import StatCard from "../../../../components/shared/StatCard";
import SubmissionHistory from "../../../../components/reviewer/SubmissionHistory";

export const metadata = { title: "My submissions · RapportLook" };

const PLATFORM_LABEL = { google: "Google", trustpilot: "Trustpilot", capterra: "Capterra", amazon: "Amazon", playstore: "Play Store" };

export default async function ReviewerFeedbackPage() {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const subs = await Submission.find({ reviewer: user.id }).sort({ createdAt: -1 }).lean();
  const campaigns = await Campaign.find({ _id: { $in: subs.map((s) => s.campaign) } }).select("name platform").lean();
  const cMap = new Map(campaigns.map((c) => [String(c._id), c]));

  const approved = subs.filter((s) => s.status === "approved").length;
  const pending = subs.filter((s) => s.status === "pending").length;
  const rejected = subs.filter((s) => s.status === "rejected").length;
  const totalEarned = subs.filter((s) => s.status === "approved").reduce((sum, s) => sum + (s.rewardAmount ?? 0), 0);

  const submissions = subs.map((s) => {
    const c = cMap.get(String(s.campaign));
    return {
      id: String(s._id),
      campaignName: c?.name ?? "Campaign",
      platform: PLATFORM_LABEL[c?.platform] ?? c?.platform ?? "",
      screenshotUrl: s.screenshotUrl,
      note: s.note,
      status: s.status,
      rejectionReason: s.rejectionReason,
      rewardAmount: s.rewardAmount,
      createdAt: s.createdAt.toISOString(),
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">My submissions</h1>
      <p className="mt-2 text-secondary">Reviews you&apos;ve submitted and their verification status.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total earned" value={inr(totalEarned)} Icon={MessageSquare} tone="text-accent" />
        <StatCard label="Approved" value={String(approved)} Icon={CheckCircle2} tone="text-verified" />
        <StatCard label="Pending" value={String(pending)} Icon={Clock} tone="text-pending" />
        <StatCard label="Rejected" value={String(rejected)} Icon={XCircle} tone="text-danger" />
      </div>

      <SubmissionHistory submissions={submissions} />
    </div>
  );
}

import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import { getSettings } from "../../../../lib/settings";
import VerificationQueue from "../../../../components/admin/VerificationQueue";

export const metadata = { title: "Verification · Admin", robots: { index: false } };

export default async function AdminVerificationPage() {
  await requireAdmin();
  await dbConnect();

  const settings = await getSettings();
  const subs = await Submission.find({ status: "pending" }).sort({ createdAt: 1 }).lean();

  const campaigns = await Campaign.find({ _id: { $in: subs.map((s) => s.campaign) } })
    .select("name platform targetUrl").lean();
  const reviewers = await User.find({ _id: { $in: subs.map((s) => s.reviewer) } })
    .select("name email").lean();

  const cMap = new Map(campaigns.map((c) => [String(c._id), c]));
  const rMap = new Map(reviewers.map((r) => [String(r._id), r]));

  const submissions = subs.map((s) => {
    const c = cMap.get(String(s.campaign));
    const r = rMap.get(String(s.reviewer));
    return {
      id: String(s._id),
      screenshotUrl: s.screenshotUrl,
      note: s.note,
      campaignName: c?.name ?? "Campaign",
      platform: c?.platform ?? "",
      targetUrl: c?.targetUrl ?? "",
      reviewerName: r?.name ?? "",
      reviewerEmail: r?.email ?? "",
      date: new Date(s.createdAt).toLocaleString("en-IN"),
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Review verification</h1>
      <p className="mt-2 text-secondary">
        Verify reviewer submissions. Approving credits the reviewer ₹{settings.reviewerReward} and
        counts toward the campaign target.
      </p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-pending-subtle px-3 py-1.5 text-sm font-semibold text-pending">
        {submissions.length} pending
      </div>

      <div className="mt-6">
        <VerificationQueue submissions={submissions} reward={settings.reviewerReward} />
      </div>
    </div>
  );
}

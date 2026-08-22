import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import { getSettings } from "../../../../lib/settings";
import VerificationQueue from "../../../../components/admin/VerificationQueue";

export const metadata = { title: "Verification · Admin", robots: { index: false } };

export default async function AdminVerificationPage({ searchParams }) {
  await requireAdmin();
  await dbConnect();

  const params = await searchParams;
  const initialTab = ["pending", "approved", "rejected", "all"].includes(params?.tab) ? params.tab : "pending";

  const settings = await getSettings();
  // Every submission, not just the ones still awaiting a human — the AI
  // verifier decides most of these automatically at submit time, and an
  // admin still needs to see what it decided, not just the leftover
  // pending/uncertain cases.
  const subs = await Submission.find({})
    .select(
      "screenshotUrl note status verifiedBy aiDecision aiConfidence aiReason gmbChecked gmbMatched gmbReason rejectionReason campaign reviewer reviewedBy createdAt reviewedAt appealStatus appealMessage appealedAt appealResponse rewardAmount"
    )
    .sort({ createdAt: -1 })
    .lean();

  const campaigns = await Campaign.find({ _id: { $in: subs.map((s) => s.campaign) } })
    .select("name platform targetUrl reviewerReward").lean();
  const reviewers = await User.find({ _id: { $in: subs.map((s) => s.reviewer) } })
    .select("name email").lean();
  const admins = await User.find({ _id: { $in: subs.map((s) => s.reviewedBy).filter(Boolean) } })
    .select("name email").lean();

  const cMap = new Map(campaigns.map((c) => [String(c._id), c]));
  const rMap = new Map(reviewers.map((r) => [String(r._id), r]));
  const aMap = new Map(admins.map((a) => [String(a._id), a]));

  const submissions = subs.map((s) => {
    const c = cMap.get(String(s.campaign));
    const r = rMap.get(String(s.reviewer));
    const reviewedByAdmin = s.reviewedBy ? aMap.get(String(s.reviewedBy)) : null;
    return {
      id: String(s._id),
      screenshotUrl: s.screenshotUrl,
      note: s.note,
      status: s.status,
      verifiedBy: s.verifiedBy || "",
      aiDecision: s.aiDecision || "",
      aiConfidence: s.aiConfidence || 0,
      aiReason: s.aiReason || "",
      gmbChecked: s.gmbChecked || false,
      gmbMatched: s.gmbMatched || false,
      gmbReason: s.gmbReason || "",
      rejectionReason: s.rejectionReason || "",
      appealStatus: s.appealStatus || "none",
      appealMessage: s.appealMessage || "",
      appealedDate: s.appealedAt ? new Date(s.appealedAt).toLocaleString("en-IN") : "",
      appealResponse: s.appealResponse || "",
      reviewedByName: reviewedByAdmin ? (reviewedByAdmin.name || reviewedByAdmin.email) : "",
      // What THIS submission would pay if approved (or DID pay, if it's
      // already rejected and up for an "approve anyway" override) — the
      // campaign's own reward override (api/admin/campaigns/[id]/reward) if
      // it has one, otherwise the platform default. Never assume the global
      // rate applies to every row.
      reward: c?.reviewerReward ?? settings.reviewerReward,
      // What an ALREADY-APPROVED submission was actually paid at the time —
      // frozen on Submission.rewardAmount, so it stays historically accurate
      // even if the campaign's reward override changes later.
      rewardAmount: s.rewardAmount || 0,
      campaignName: c?.name ?? "Campaign",
      platform: c?.platform ?? "",
      targetUrl: c?.targetUrl ?? "",
      reviewerName: r?.name ?? "",
      reviewerEmail: r?.email ?? "",
      date: new Date(s.createdAt).toLocaleString("en-IN"),
      reviewedDate: s.reviewedAt ? new Date(s.reviewedAt).toLocaleString("en-IN") : "",
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Review verification</h1>
      <p className="mt-2 text-secondary">
        Verify reviewer submissions. Approving credits the reviewer and counts toward the campaign
        target — most campaigns pay the platform default (₹{settings.reviewerReward}), but a
        campaign with its own reward override (set on the Campaigns page) pays that instead.
      </p>

      <div className="mt-8">
        <VerificationQueue submissions={submissions} initialTab={initialTab} />
      </div>
    </div>
  );
}

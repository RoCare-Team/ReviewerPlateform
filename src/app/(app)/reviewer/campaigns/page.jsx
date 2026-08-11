import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import Campaign from "../../../../models/Campaign";
import Submission from "../../../../models/Submission";
import User from "../../../../models/User";
import { getSettings } from "../../../../lib/settings";
import { releaseExpiredClaims } from "../../../../lib/claims";
import CampaignParticipation from "../../../../components/reviewer/CampaignParticipation";

export const metadata = { title: "Available campaigns · RapportLook" };

export default async function ReviewerCampaignsPage() {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const settings = await getSettings();

  const [mySubs, openCampaigns, me] = await Promise.all([
    Submission.find({ reviewer: user.id }).select("campaign status").lean(),
    Campaign.find({ status: "active" }).sort({ createdAt: -1 }).lean(),
    User.findById(user.id).select("location.city").lean(),
  ]);

  // Best-effort: release any of these campaigns' abandoned claims (reviewer
  // opened the link, never submitted, TTL passed) before computing "spots
  // left" below, so the count reflects reality rather than waiting on
  // Mongo's background TTL sweep.
  await Promise.all(openCampaigns.map((c) => releaseExpiredClaims(c._id)));
  const refreshed = await Campaign.find({ _id: { $in: openCampaigns.map((c) => c._id) } })
    .select("claimed")
    .lean();
  const claimedById = new Map(refreshed.map((c) => [String(c._id), c.claimed ?? 0]));

  // campaignId → this reviewer's status on it. Only an approved or still-
  // pending submission makes a campaign unavailable — a rejected one doesn't,
  // so it keeps showing up here for a resubmission with a new screenshot.
  const statusByCampaign = new Map(mySubs.map((s) => [String(s.campaign), s.status]));

  // Reviewer's own detected city (src/models/User.js `location.city`, set
  // from browser geolocation — see api/reviewer/location). A campaign with
  // no city set is open to anyone; one WITH a city only shows to reviewers
  // in that same city (case-insensitive) — this is the whole point of
  // capturing city at campaign creation.
  const reviewerCity = (me?.location?.city || "").trim().toLowerCase();

  const available = openCampaigns
    .filter((c) => {
      const claimed = claimedById.get(String(c._id)) ?? 0;
      // Slots spoken for = approved (collected) + reserved-but-undecided
      // (claimed: an open link or a still-pending submission). Gating on
      // `collected` alone is exactly the bug this fixes — it let every
      // reviewer see the campaign as open even after enough others had
      // already claimed (or filled) every slot.
      if ((c.collected ?? 0) + claimed >= c.targetReviews) return false;
      const status = statusByCampaign.get(String(c._id));
      if (status && status !== "rejected") return false;

      const campaignCity = (c.city || "").trim().toLowerCase();
      if (campaignCity && reviewerCity && campaignCity !== reviewerCity) return false;
      return true;
    })
    .map((c) => {
      const claimed = claimedById.get(String(c._id)) ?? 0;
      return {
        id: String(c._id),
        name: c.name,
        platform: c.platform,
        city: c.city || "",
        notes: c.notes,
        collected: c.collected ?? 0,
        target: c.targetReviews,
        remaining: c.targetReviews - (c.collected ?? 0) - claimed,
        previouslyRejected: statusByCampaign.get(String(c._id)) === "rejected",
        // Admin can pay a specific campaign's reviewers more or less than
        // the platform default (Campaign.reviewerReward — see
        // api/admin/campaigns/[id]/reward). Falls back to the global rate
        // when no override is set, same resolution approveSubmission() uses.
        reward: c.reviewerReward ?? settings.reviewerReward,
      };
    });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Available campaigns</h1>
      <p className="mt-2 text-secondary">
        Earn a reward for every verified review — shown on each campaign below. Rewards are for
        verified participation, never for positive ratings.
      </p>

      <div className="mt-8">
        <CampaignParticipation campaigns={available} />
      </div>
    </div>
  );
}

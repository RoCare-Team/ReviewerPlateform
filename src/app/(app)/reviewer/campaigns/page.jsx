import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import { getAvailableCampaignsForReviewer, getReviewerCooldownState } from "../../../../lib/reviewerCampaigns";
import CampaignParticipation from "../../../../components/reviewer/CampaignParticipation";
import ReviewerCooldownNotice from "../../../../components/reviewer/ReviewerCooldownNotice";

export const metadata = { title: "Available campaigns · RapportLook" };

export default async function ReviewerCampaignsPage() {
  const user = await requireRole(ROLES.REVIEWER);

  // Campaigns stay listed during a cooldown — only the booking buttons lock,
  // with the notice above spelling out the wait. See lib/reviewerCampaigns.js.
  const [available, cooldown] = await Promise.all([
    getAvailableCampaignsForReviewer(user.id),
    getReviewerCooldownState(user.id),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Available campaigns</h1>
      <p className="mt-2 hidden text-secondary sm:block">
        Earn a reward for every verified review — shown on each campaign below. Rewards are for
        verified participation, never for positive ratings.
      </p>

      <ReviewerCooldownNotice cooldown={cooldown} />

      <div className="mt-8">
        <CampaignParticipation campaigns={available} cooldown={cooldown} />
      </div>
    </div>
  );
}

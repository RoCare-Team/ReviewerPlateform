import dbConnect from "./db";
import Campaign from "../models/Campaign";
import Submission from "../models/Submission";
import User from "../models/User";
import Claim from "../models/Claim";
import { formatWait, getSettings } from "./settings";
import { releaseExpiredClaims } from "./claims";
import { checkPacing, checkReviewerCooldown } from "./pacing";
import { campaignCities, campaignOpenToCity } from "./campaigns";

/**
 * The single source of truth for "which active campaigns can this reviewer
 * actually join right now" — every slot/city/pacing/resubmission rule lives
 * here ONCE so the overview page's count (reviewer/page.jsx) can never drift
 * from what /reviewer/campaigns actually lists. Previously the overview page
 * had its own shortcut version of this filter (collected-only, no city, no
 * pacing, no claimed-slots) which is why its count didn't match reality —
 * see the bug report this fixes.
 */
export async function getAvailableCampaignsForReviewer(userId) {
  const { available } = await getReviewerCampaignFeed(userId);
  return available;
}

/**
 * The same pass, but it also hands back WHY the list is short: every campaign
 * this reviewer's city qualifies them for that is merely busy right now —
 * every slot taken, or the campaign's own drip pacing (lib/pacing.js) hasn't
 * elapsed yet.
 *
 * Worth the extra bookkeeping because "No campaigns available right now" is
 * indistinguishable from a broken page. A reviewer in a city with two paced
 * campaigns sees an empty screen for most of the day and reasonably concludes
 * the app is broken; "2 campaigns in Gurugram, next one opens in about 4
 * hours" is the same fact, minus the support ticket.
 *
 * Campaigns for OTHER cities are deliberately not counted — they are not this
 * reviewer's to wait for, and listing them would only read as a tease.
 */
export async function getReviewerCampaignFeed(userId) {
  await dbConnect();
  const settings = await getSettings();

  const [mySubs, openCampaigns, me] = await Promise.all([
    Submission.find({ reviewer: userId }).select("campaign status").lean(),
    Campaign.find({ status: "active" }).sort({ createdAt: -1 }).lean(),
    User.findById(userId).select("location.city").lean(),
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

  // This reviewer's own still-live claims (survived the releaseExpiredClaims
  // sweep above). Passed down so the countdown on the client can resume from
  // the real, server-persisted expiry on page load/navigation-back, instead
  // of only ever starting from a fresh click — see CampaignParticipation.jsx.
  const myClaims = await Claim.find({ reviewer: userId, campaign: { $in: openCampaigns.map((c) => c._id) } })
    .select("campaign expiresAt reviewDraft.text reviewImage.url")
    .lean();
  const myClaimByCampaign = new Map(myClaims.map((cl) => [String(cl.campaign), cl]));

  // Drip pacing (Campaign.pacingLimit/pacingWindowHours) — a paced campaign
  // that's already at its "reviews per window" cap simply doesn't show up
  // here until the oldest one in the window ages out. See lib/pacing.js.
  // Only checked for campaigns that actually configured pacing.
  const pacedCampaigns = openCampaigns.filter((c) => c.pacingLimit && c.pacingWindowHours);
  const pacingResults = await Promise.all(pacedCampaigns.map((c) => checkPacing(c)));
  const pacingBlockedIds = new Set(
    pacedCampaigns.filter((c, i) => pacingResults[i].blocked).map((c) => String(c._id))
  );
  // …and WHEN each of those frees up, so a blocked campaign can say "opens in
  // about 4 hours" instead of just vanishing.
  const pacingNextById = new Map(
    pacedCampaigns
      .map((c, i) => [String(c._id), pacingResults[i].nextAvailableAt])
      .filter(([, at]) => at)
  );

  // campaignId → this reviewer's status on it. Only an approved or still-
  // pending submission makes a campaign unavailable — a rejected one doesn't,
  // so it keeps showing up here for a resubmission with a new screenshot.
  const statusByCampaign = new Map(mySubs.map((s) => [String(s.campaign), s.status]));

  // Reviewer's own declared city (src/models/User.js `location.city`, set at
  // signup — see PhoneOtpForm.jsx). A campaign with no cities set is open to
  // anyone; one WITH cities only shows to reviewers in one of those cities
  // (case-insensitive) — see lib/campaigns.js#campaignOpenToCity, which also
  // resolves the legacy single-city field batch campaigns still use.
  const reviewerCity = (me?.location?.city || "").trim();

  // Filled in by the filter below — campaigns this reviewer WOULD see if they
  // weren't momentarily busy. See the docblock above.
  const waiting = [];

  const available = openCampaigns
    .filter((c) => {
      const claimed = claimedById.get(String(c._id)) ?? 0;
      // Slots spoken for = approved (collected) + reserved-but-undecided
      // (claimed: an open link or a still-pending submission). A reviewer
      // with their OWN live claim always still sees it, even if that claim
      // is what makes the campaign read as "full" — it's their reserved
      // slot, not a new one.
      const hasMyClaim = myClaimByCampaign.has(String(c._id));
      // City and "already done" are checked FIRST so the waiting list only
      // ever describes campaigns that are genuinely this reviewer's to wait
      // for — not another city's, and not one they already reviewed.
      if (!campaignOpenToCity(c, reviewerCity)) return false;
      const status = statusByCampaign.get(String(c._id));
      if (status && status !== "rejected") return false;

      if (!hasMyClaim && (c.collected ?? 0) + claimed >= c.targetReviews) {
        waiting.push({ id: String(c._id), name: c.name, reason: "full", availableAt: null });
        return false;
      }
      if (!hasMyClaim && pacingBlockedIds.has(String(c._id))) {
        waiting.push({
          id: String(c._id),
          name: c.name,
          reason: "paced",
          // When the campaign's own gap elapses — the client turns this into
          // a live "opens in ~4 hours".
          availableAt: pacingNextById.get(String(c._id))?.toISOString() ?? null,
        });
        return false;
      }
      return true;
    })
    .map((c) => {
      const claimed = claimedById.get(String(c._id)) ?? 0;
      return {
        id: String(c._id),
        name: c.name,
        platform: c.platform,
        cities: campaignCities(c),
        businessName: c.businessName || "",
        businessCategory: c.businessCategory || "",
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
        // ISO string (or null) — resumes the countdown on mount instead of
        // only ever starting fresh from a client click. See page.jsx comment
        // above and CampaignParticipation.jsx's Card component.
        activeClaimExpiresAt: myClaimByCampaign.get(String(c._id))?.expiresAt?.toISOString() ?? null,
        activeReviewText: myClaimByCampaign.get(String(c._id))?.reviewDraft?.text || "",
        activeImageUrl: myClaimByCampaign.get(String(c._id))?.reviewImage?.url || "",
      };
    });

  // Soonest first — the empty state only quotes the next one to open.
  waiting.sort((a, b) => new Date(a.availableAt ?? 8.64e15) - new Date(b.availableAt ?? 8.64e15));
  return { available, waiting, city: reviewerCity };
}

/**
 * Serializable cooldown state for the reviewer UI — "can this reviewer start
 * another review right now, and if not, when?".
 *
 * Deliberately NOT folded into getAvailableCampaignsForReviewer(): a reviewer
 * on cooldown should still SEE the campaigns waiting for them (with the wait
 * spelled out), not watch the list mysteriously empty out and refill four
 * hours later. The campaign filter answers "which campaigns", this answers
 * "when can I act" — two different questions, so two different calls.
 *
 * `waitLabel` is rendered on the server so the notice reads correctly on the
 * very first paint; the client then counts `nextAvailableAt` down live.
 */
export async function getReviewerCooldownState(userId) {
  await dbConnect();
  const { reviewerCooldownHours } = await getSettings();
  const state = await checkReviewerCooldown(userId, reviewerCooldownHours);
  return {
    hours: state.cooldownHours,
    blocked: state.blocked,
    nextAvailableAt: state.nextAvailableAt ? state.nextAvailableAt.toISOString() : null,
    waitLabel: state.blocked ? formatWait(state.msLeft) : "",
  };
}

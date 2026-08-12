import Claim from "../models/Claim";
import Submission from "../models/Submission";

/**
 * Optional per-campaign "drip" pacing (Campaign.pacingLimit / pacingWindowHours)
 * — spaces reviews out evenly instead of letting them all land in a burst,
 * which is exactly the pattern Google's fake-engagement detection flags
 * (sometimes taking down the whole listing's reviews, not just the
 * suspicious ones).
 *
 * The owner enters it as "N reviews every Y day(s)" (e.g. "5 reviews every 1
 * day") because that's how they think about it — but that's converted into a
 * single **fixed gap**: gapHours = pacingWindowHours / pacingLimit (24h / 5 =
 * 4.8h here). Enforcement is then just "has a review landed within the last
 * gapHours?" — not "have N reviews landed somewhere in the last Y days",
 * which would still let all 5 through in the first hour and then go silent
 * for the rest of the day. A fixed gap is what actually spreads them out.
 *
 * What counts as "landed" — a LIVE claim (reviewer has an open link and
 * hasn't expired/abandoned it) or a non-rejected Submission (pending or
 * approved). A claim that expired without a submission never counted at
 * all (it's simply gone — see releaseExpiredClaims), so an abandoned attempt
 * never eats into the pacing gap; only real attempts do.
 */

/** The fixed gap (in hours) enforced between reviews, or null if unpaced. */
export function pacingGapHours(campaign) {
  if (!campaign.pacingLimit || !campaign.pacingWindowHours) return null;
  return campaign.pacingWindowHours / campaign.pacingLimit;
}

/**
 * Returns { blocked: false } if the campaign has no pacing configured or the
 * gap has already elapsed since the last review, or
 * { blocked: true, nextAvailableAt } if a review landed too recently —
 * `nextAvailableAt` is when the gap since that review will have elapsed.
 */
export async function checkPacing(campaign) {
  const gapHours = pacingGapHours(campaign);
  if (!gapHours) return { blocked: false };

  const [lastClaim, lastSubmission] = await Promise.all([
    Claim.findOne({ campaign: campaign._id }).sort({ createdAt: -1 }).select("createdAt").lean(),
    Submission.findOne({ campaign: campaign._id, status: { $ne: "rejected" } })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean(),
  ]);

  const lastAt = [lastClaim?.createdAt, lastSubmission?.createdAt].filter(Boolean).sort((a, b) => b - a)[0];
  if (!lastAt) return { blocked: false };

  const nextAvailableAt = new Date(lastAt.getTime() + gapHours * 60 * 60 * 1000);
  if (nextAvailableAt <= new Date()) return { blocked: false };
  return { blocked: true, nextAvailableAt };
}

/** Convenience for filtering lists — same as checkPacing but just a boolean. */
export async function isPacingBlocked(campaign) {
  const result = await checkPacing(campaign);
  return result.blocked;
}

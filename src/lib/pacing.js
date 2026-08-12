import Claim from "../models/Claim";
import Submission from "../models/Submission";

/**
 * Optional per-campaign "drip" pacing (Campaign.pacingLimit / pacingWindowHours)
 * — caps how many reviews can land within a trailing time window, so a
 * campaign that wants 10 reviews doesn't get all 10 posted to Google within
 * the same hour. That kind of burst is exactly what Google's fake-engagement
 * detection flags, sometimes taking down the whole listing's reviews, not
 * just the suspicious ones.
 *
 * A rolling window, not a calendar-day reset: the check always looks at "the
 * last N hours from right now", so there's no fixed reset moment reviewers
 * could all pile onto at once.
 *
 * What counts as "landed" — a LIVE claim (reviewer has an open link and
 * hasn't expired/abandoned it) or a non-rejected Submission (pending or
 * approved). A claim that expired without a submission never counted at
 * all (it's simply gone — see releaseExpiredClaims), so an abandoned attempt
 * never eats into the reviewer's pacing budget; only real attempts do.
 */

/**
 * Returns { blocked: false } if the campaign has no pacing configured or is
 * under its limit right now, or { blocked: true, nextAvailableAt } if the
 * window is full — `nextAvailableAt` is when the oldest event inside the
 * current window will age out and free up a slot.
 */
export async function checkPacing(campaign) {
  if (!campaign.pacingLimit || !campaign.pacingWindowHours) {
    return { blocked: false };
  }

  const windowStart = new Date(Date.now() - campaign.pacingWindowHours * 60 * 60 * 1000);

  const [claims, submissions] = await Promise.all([
    Claim.find({ campaign: campaign._id, createdAt: { $gte: windowStart } }).select("createdAt").lean(),
    Submission.find({
      campaign: campaign._id,
      status: { $ne: "rejected" },
      createdAt: { $gte: windowStart },
    })
      .select("createdAt")
      .lean(),
  ]);

  const timestamps = [...claims, ...submissions].map((d) => d.createdAt).sort((a, b) => a - b);

  if (timestamps.length < campaign.pacingLimit) {
    return { blocked: false };
  }

  // Full — figure out when the OLDEST event still inside the limit ages out
  // of the window. E.g. limit=1: the single most recent event's own
  // timestamp + windowHours. limit=3 with 5 events in-window: the 3rd-oldest
  // (index length-limit) is what has to expire before a new one fits.
  const oldestStillCounted = timestamps[timestamps.length - campaign.pacingLimit];
  const nextAvailableAt = new Date(oldestStillCounted.getTime() + campaign.pacingWindowHours * 60 * 60 * 1000);
  return { blocked: true, nextAvailableAt };
}

/** Convenience for filtering lists — same as checkPacing but just a boolean. */
export async function isPacingBlocked(campaign) {
  const result = await checkPacing(campaign);
  return result.blocked;
}

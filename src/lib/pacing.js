import Claim from "../models/Claim";
import Submission from "../models/Submission";
import { getSettings } from "./settings";

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

/**
 * Platform-wide reviewer cap — at most this many reviews SUBMITTED per
 * reviewer per calendar day, across every campaign combined. Separate from
 * the per-campaign drip pacing above (that's the business slowing down ONE
 * campaign; this is capping one reviewer's total daily throughput
 * everywhere, the same fraud-pattern concern Google flags — one account
 * posting a burst of reviews across many businesses in a single day).
 *
 * "Day" is the UTC calendar day — simplest correct boundary without pulling
 * in a timezone library; a review at 12:01am UTC and one at 11:59pm UTC the
 * same day both count, same as any two on the same date would.
 */
export const REVIEWER_DAILY_SUBMISSION_LIMIT = 1;

function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * How many submissions this reviewer has made today, counting every attempt
 * regardless of status (approved/pending/rejected all still spend today's
 * single try) — but NOT a resubmission after a rejection, which overwrites
 * the same Submission doc in place rather than creating a new one, so it
 * doesn't touch `createdAt` and can't inflate today's count on retry. That
 * retry is also exempted from this cap at the call site, otherwise a cap of
 * one would make "resubmit with a better screenshot" impossible until
 * tomorrow. See api/reviewer/submissions/route.js.
 */
export async function reviewerSubmissionsToday(reviewerId) {
  return Submission.countDocuments({ reviewer: reviewerId, createdAt: { $gte: startOfTodayUTC() } });
}

/** { blocked, count } — true once today's count has reached the daily cap. */
export async function checkReviewerDailyLimit(reviewerId) {
  const count = await reviewerSubmissionsToday(reviewerId);
  return { blocked: count >= REVIEWER_DAILY_SUBMISSION_LIMIT, count };
}

/**
 * Platform-wide cap per CONNECTION — at most this many reviews submitted per
 * client IP per calendar day, whoever submits them.
 *
 * The per-reviewer cap above is per account, so it does nothing against the
 * cheapest farm there is: several accounts on one phone/router taking turns.
 * Same day, same connection, different logins is exactly the pattern Google's
 * fake-engagement detection flags, so the IP gets one review a day too.
 *
 * The IP comes from the proxy chain (lib/rate-limit.js#clientIp) and is
 * recorded on each Submission as `submitIp`. Two honest caveats:
 *   - It is only as trustworthy as the edge that sets x-forwarded-for; verify
 *     yours strips a client-supplied one (same caveat as the rate limiter).
 *   - Shared NAT (an office, a college, a mobile carrier) means genuine
 *     separate reviewers can share an IP and the second one is turned away.
 *     That's the deliberate trade — the farm case is the one being priced in.
 * An unknown/blank IP is never counted, so a missing header can't lock out
 * every reviewer at once.
 */
export const IP_DAILY_SUBMISSION_LIMIT = 1;

/** True for an IP we can't actually attribute — never enforced against. */
function usableIp(ip) {
  return Boolean(ip) && ip !== "unknown";
}

/** How many submissions came from this IP today, any reviewer, any status. */
export async function submissionsFromIpToday(ip) {
  if (!usableIp(ip)) return 0;
  return Submission.countDocuments({ submitIp: ip, createdAt: { $gte: startOfTodayUTC() } });
}

/** { blocked, count } — true once this IP has spent today's allowance. */
export async function checkIpDailyLimit(ip) {
  if (!usableIp(ip)) return { blocked: false, count: 0 };
  const count = await submissionsFromIpToday(ip);
  return { blocked: count >= IP_DAILY_SUBMISSION_LIMIT, count };
}

/**
 * Platform-wide reviewer COOLDOWN — the minimum gap a reviewer must leave
 * between two submissions, across every campaign combined.
 *
 * Sits alongside the daily cap above but answers a different question: the cap
 * is "how many in a day", this is "how close together". With the daily cap at
 * one it rarely binds on its own, but it still spaces out the cases the cap
 * doesn't count — a retry after a rejection, or the first review of a new day
 * landing minutes after yesterday's last one, which is the burst pattern
 * Google's fake-engagement detection flags on the reviewer's own account.
 *
 * The gap is NOT hardcoded — it's `reviewerCooldownHours` on the AppSettings
 * singleton, editable by admin at /admin/pricing (default 4 hours). Setting it
 * to 0 switches the cooldown off entirely.
 *
 * What starts the clock: the reviewer's most recent NON-rejected submission
 * (pending or approved) — the same "what counts as landed" rule the
 * per-campaign pacing above uses. A rejected attempt deliberately does not
 * start it, otherwise a reviewer whose screenshot was auto-rejected would be
 * locked out for hours before they could retry with a correct one.
 */
export async function checkReviewerCooldown(reviewerId, cooldownHours) {
  // Callers that already loaded settings pass the hours in; the rest let this
  // read them, so no route can forget and silently skip the cooldown.
  const hours = cooldownHours === undefined ? (await getSettings()).reviewerCooldownHours : Number(cooldownHours);
  if (!Number.isFinite(hours) || hours <= 0) return { blocked: false, cooldownHours: 0 };

  const last = await Submission.findOne({ reviewer: reviewerId, status: { $ne: "rejected" } })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean();
  if (!last) return { blocked: false, cooldownHours: hours };

  const nextAvailableAt = new Date(last.createdAt.getTime() + hours * 60 * 60 * 1000);
  const msLeft = nextAvailableAt.getTime() - Date.now();
  if (msLeft <= 0) return { blocked: false, cooldownHours: hours, lastSubmittedAt: last.createdAt };
  return { blocked: true, cooldownHours: hours, nextAvailableAt, msLeft, lastSubmittedAt: last.createdAt };
}

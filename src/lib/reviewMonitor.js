import Campaign from "../models/Campaign";
import GmbConnection from "../models/GmbConnection";
import GmbLocation from "../models/GmbLocation";
import Submission from "../models/Submission";
import { getValidAccessToken, listReviews } from "./gmb";
import { getSettings } from "./settings";
import { unverifySubmission } from "./verification";

/**
 * Post-payment review monitoring — "the reviewer was paid ₹50, is the review
 * still there?"
 *
 * An approved Submission is money that has already left the business's wallet
 * and landed in the reviewer's. If the review later disappears from Google —
 * the reviewer deleted it themselves, or Google's spam filtering pulled it —
 * the business paid for something that no longer exists, and nothing in the
 * app would ever notice: lib/gmbVerification.js only runs on the way IN, and
 * syncConnectionReviews() only ever upserts, so our own GmbReview copy of a
 * deleted review lives on forever. This module is the way back out.
 *
 * WHAT HAPPENS WHEN A REVIEW IS GONE
 * With AppSettings.autoReverseRemovedReviews on (the default), a confirmed
 * disappearance claws the reward straight back out of the reviewer's wallet —
 * no queue, no admin. That is a real person's money moving without a human, so
 * the bar for "confirmed" is doing all of the work:
 *
 *   - A read that could not see the whole listing is `conclusive: false` and
 *     changes NOTHING — not the streak, not the balance. A revoked Google
 *     connection, a rate-limit or an API blip all look exactly like "review
 *     gone" from the outside, and none of them are.
 *   - A read is only `complete` when the number of reviews Google's API
 *     actually handed us is at least the totalReviewCount Google itself
 *     reports for that listing. Google returns fewer reviews than it counts
 *     often enough (filtered, held, mid-reindex) that treating the gap as
 *     deletion would take money off the wrong people. Only a complete read
 *     may auto-reverse.
 *   - A conclusive miss on an INCOMPLETE read still means something, so it
 *     is not thrown away: it accrues a streak and, at MISSING_STREAK_TO_FLAG,
 *     lands in /admin/removed-reviews for a human to judge.
 *
 * Every automatic reversal is recorded on the submission
 * (reviewAutoReversedAt) and stays listed for an admin, who can approve it
 * again if the review turns out to be there after all.
 */

/**
 * Consecutive CONCLUSIVE misses before a submission is flagged for an admin.
 *
 * This governs only the MANUAL path — the misses seen on an incomplete listing
 * read, which never auto-reverse. Two, not one: on evidence already known to
 * be partial, one unlucky read shouldn't put a reviewer in a queue that ends
 * in their money being taken back. A complete read needs no such margin; it
 * reverses on the first confirmed miss.
 */
export const MISSING_STREAK_TO_FLAG = 2;

/**
 * How many pages of reviews (50 each) to read per location before giving up
 * and calling the check inconclusive. Five pages ≈ 250 reviews covers all but
 * the busiest listings; beyond that the honest answer is "we can't be sure",
 * which is what gets recorded.
 */
const MAX_PAGES = 5;

/**
 * Every review id currently live on one location's Google listing.
 *
 * Returns { ok, ids, total, complete, reason }.
 *
 * `ok: false` means we could not build a picture at all (no connection, token
 * refresh failed, API error, or more reviews than MAX_PAGES can cover) —
 * callers MUST treat that as "no information", never as "the review is gone".
 *
 * `complete` is the stronger claim, and the one an automatic clawback hangs
 * on: we read every page AND ended up with at least as many reviews as
 * Google's own totalReviewCount says the listing has. When Google reports more
 * than it hands over — filtered reviews, a listing mid-reindex — the missing
 * ones are unknown to us, so `ok` stays true (the read worked) but
 * `complete` is false and no money may move on it.
 *
 * `ids` is a Set of the bare review ids, matching how Submission.gmbReviewId
 * and GmbReview.reviewId are stored (see normalizeReview in lib/gmb.js).
 */
export async function fetchLiveReviewIds(location) {
  // Not scoped to status:"active" so the reason can say WHY, the same way
  // lib/gmbVerification.js does.
  const conn = await GmbConnection.findOne({ _id: location.connection }).select("+accessToken +refreshToken");
  if (!conn) {
    return { ok: false, ids: new Set(), total: 0, complete: false, reason: "Business's Google account isn't connected." };
  }
  if (conn.status === "revoked" || conn.status === "error") {
    return {
      ok: false,
      ids: new Set(),
      total: 0,
      complete: false,
      reason: conn.lastError || "Business's Google account needs reconnecting before reviews can be checked.",
    };
  }

  let accessToken;
  try {
    accessToken = await getValidAccessToken(conn);
  } catch (e) {
    return { ok: false, ids: new Set(), total: 0, complete: false, reason: `Token refresh failed: ${e.message}` };
  }

  const ids = new Set();
  let total = 0;
  let pageToken = "";
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let data;
    try {
      data = await listReviews(accessToken, location.accountName, location.locationName, { pageToken });
    } catch (e) {
      return { ok: false, ids, total, complete: false, reason: `Couldn't read reviews from Google: ${e.message}` };
    }
    for (const raw of data.reviews ?? []) {
      const id = raw.reviewId ?? raw.name ?? "";
      if (id) ids.add(id);
    }
    // Google's own count for the listing, which is NOT always the number of
    // reviews it will hand over — see this function's docblock.
    total = Math.max(total, Number(data.totalReviewCount ?? 0));
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) {
      const complete = ids.size >= total;
      return {
        ok: true,
        ids,
        total,
        complete,
        reason: complete
          ? ""
          : `Google reports ${total} reviews on this listing but its API only returned ${ids.size} — the rest can't be accounted for.`,
      };
    }
  }

  return {
    ok: false,
    ids,
    total,
    complete: false,
    reason: `This listing has more than ${MAX_PAGES * 50} reviews — couldn't read far enough to be sure.`,
  };
}

/**
 * Write one check's outcome onto the submission and decide whether it belongs
 * in the admin queue. Returns "inconclusive" | "present" | "watching" (a
 * conclusive miss that hasn't hit the streak yet) | "missing" | "gone" (the
 * submission stopped being approved mid-run).
 *
 * Guarded on status:"approved" throughout — a submission an admin reversed
 * while this run was in flight must not get its monitoring fields rewritten.
 */
export async function recordReviewCheck(submissionId, { conclusive, present, reason }) {
  const now = new Date();

  if (!conclusive) {
    // Deliberately does NOT touch the streak. A Google outage, an expired
    // token or a too-large listing must never accumulate towards accusing a
    // reviewer — it only records that we looked and why nothing came of it.
    await Submission.updateOne(
      { _id: submissionId, status: "approved" },
      { $set: { reviewCheckedAt: now, reviewCheckNote: reason } }
    );
    return "inconclusive";
  }

  if (present) {
    // Back to (or still) live. This also clears an earlier "missing" flag and
    // an admin's "dismissed" — if the review is demonstrably there, whatever
    // was decided about its absence no longer describes reality.
    await Submission.updateOne(
      { _id: submissionId, status: "approved" },
      {
        $set: {
          reviewLiveStatus: "present",
          reviewCheckedAt: now,
          reviewMissingStreak: 0,
          reviewMissingSince: null,
          reviewCheckNote: reason,
        },
      }
    );
    return "present";
  }

  const sub = await Submission.findOneAndUpdate(
    { _id: submissionId, status: "approved" },
    { $inc: { reviewMissingStreak: 1 }, $set: { reviewCheckedAt: now, reviewCheckNote: reason } },
    { returnDocument: "after" }
  );
  if (!sub) return "gone";

  const patch = {};
  // First miss of a streak — remember when the review was last seen alive.
  if (sub.reviewMissingStreak === 1) patch.reviewMissingSince = now;
  // "dismissed" is an admin's explicit "I looked at this, it's fine" — later
  // misses of the same already-judged review must not drag it back into the
  // queue. Only a `present` check (above) undoes a dismissal.
  if (sub.reviewMissingStreak >= MISSING_STREAK_TO_FLAG && sub.reviewLiveStatus !== "dismissed") {
    patch.reviewLiveStatus = "missing";
  }
  if (Object.keys(patch).length > 0) {
    await Submission.updateOne({ _id: submissionId, status: "approved" }, { $set: patch });
  }

  return sub.reviewMissingStreak >= MISSING_STREAK_TO_FLAG ? "missing" : "watching";
}

/** Submissions per batch — caps the Google reads one invocation can do. */
export const RECHECK_BATCH_LIMIT = 15;

/**
 * One batch of the recheck: pick the submissions least recently looked at,
 * read each listing ONCE however many submissions point at it, and record
 * every verdict. Returns { checked, present, missing, watching, inconclusive,
 * skipped, errors }.
 *
 * With AppSettings.autoReverseRemovedReviews on, a confirmed miss on a
 * COMPLETE listing read has the reward taken straight back off the reviewer
 * here — see this module's docblock for why "complete" is doing the load
 * bearing. Misses on an incomplete read never move money; they accrue towards
 * the admin queue instead. Reversal failures are collected per-submission and
 * never abort the run.
 *
 * `fetchLive` exists only so the decision logic below — which moves money —
 * can be exercised against known listing states without calling Google.
 * Production callers leave it alone.
 *
 * `before` is the whole scheduling policy, and it's the caller's to choose:
 * only submissions never checked, or last checked before that moment, are
 * eligible. The hourly cron passes "24 hours ago", so a submission is looked
 * at about once a day. An admin pressing "Check now" passes the moment their
 * sweep STARTED — which both ignores the daily gap and gives the sweep a
 * termination point, since every submission this run touches is stamped
 * later than `before` and so drops out of the next batch. Passing "now"
 * repeatedly would just cycle the same rows forever.
 */
export async function runReviewRecheck({ before, limit = RECHECK_BATCH_LIMIT, fetchLive = fetchLiveReviewIds } = {}) {
  const candidates = await Submission.find({
    status: "approved",
    gmbMatched: true,
    gmbReviewId: { $nin: ["", null] },
    // Ascending sort puts nulls (never checked) first, then the
    // longest-unchecked — so every approved submission comes round eventually
    // instead of the same few being re-read every time.
    $or: [{ reviewCheckedAt: null }, { reviewCheckedAt: { $lte: before } }],
  })
    .sort({ reviewCheckedAt: 1 })
    .limit(limit)
    .select("campaign gmbReviewId reviewLiveStatus rewardAmount")
    .lean();

  const empty = { checked: 0, present: 0, missing: 0, watching: 0, inconclusive: 0, skipped: 0, reversed: 0, reclaimed: 0, errors: [] };
  if (candidates.length === 0) return empty;

  const { autoReverseRemovedReviews } = await getSettings();

  // Resolve each submission's campaign → location, then group by location so
  // one listing is read once however many submissions point at it.
  const campaigns = await Campaign.find({ _id: { $in: candidates.map((s) => s.campaign) } })
    .select("location")
    .lean();
  const campaignLocation = new Map(campaigns.map((c) => [String(c._id), c.location ? String(c.location) : ""]));

  const byLocation = new Map();
  let skipped = 0;
  for (const sub of candidates) {
    const locationId = campaignLocation.get(String(sub.campaign)) || "";
    if (!locationId) {
      // The campaign is gone, or its Google location link was removed after
      // approval — there is nothing left to check this against. Recorded on
      // the submission so it stops coming back every run.
      await recordReviewCheck(sub._id, {
        conclusive: false,
        present: false,
        reason: "Campaign is no longer linked to a Google Business Profile location.",
      });
      skipped += 1;
      continue;
    }
    if (!byLocation.has(locationId)) byLocation.set(locationId, []);
    byLocation.get(locationId).push(sub);
  }

  const locations = await GmbLocation.find({ _id: { $in: [...byLocation.keys()] } })
    .select("accountName locationName title connection")
    .lean();
  const locationById = new Map(locations.map((l) => [String(l._id), l]));

  const out = { ...empty, skipped };
  for (const [locationId, subs] of byLocation) {
    const location = locationById.get(locationId);
    try {
      // One read of the listing answers every submission on it. A failure
      // here is inconclusive for ALL of them — never "they all vanished".
      const live = location
        ? await fetchLive(location)
        : { ok: false, ids: new Set(), reason: "Linked Google Business Profile location not found." };

      for (const sub of subs) {
        const isPresent = live.ok && live.ids.has(sub.gmbReviewId);
        const gone = live.ok && !isPresent;
        // A miss we may act on by ourselves, versus one that only means
        // "somebody should look at this".
        const provenGone = gone && live.complete;

        const outcome = await recordReviewCheck(sub._id, {
          conclusive: live.ok,
          present: isPresent,
          reason: live.ok
            ? isPresent
              ? "Review is still live on Google."
              : provenGone
                ? "Review is no longer on the business's Google listing."
                : `Review wasn't in the listing, but the read was incomplete — ${live.reason}`
            : live.reason,
        });
        out.checked += 1;
        if (outcome === "present") out.present += 1;
        else if (outcome === "missing") out.missing += 1;
        else if (outcome === "watching") out.watching += 1;
        else if (outcome === "inconclusive") out.inconclusive += 1;

        // Money moves only here, and only on proof. recordReviewCheck ran
        // first on purpose: it guards on status "approved", which
        // unverifySubmission is about to change.
        if (provenGone && autoReverseRemovedReviews && (outcome === "watching" || outcome === "missing")) {
          try {
            const result = await unverifySubmission(
              sub._id,
              "The review you were paid for is no longer on the business's Google listing, so the reward has been reversed.",
              { verifiedBy: "system" }
            );
            if (result === "unverified" || result === "insufficient_balance") {
              await Submission.updateOne({ _id: sub._id }, { $set: { reviewAutoReversedAt: new Date() } });
              out.reversed += 1;
              out.reclaimed += sub.rewardAmount || 0;
              // The queue counts the flag, not the money — a submission whose
              // reward was just taken back isn't waiting on anyone.
              if (outcome === "missing") out.missing -= 1;
            }
          } catch (e) {
            out.errors.push(`reversal ${sub._id}: ${e.message}`);
          }
        }
      }
    } catch (e) {
      // One location's failure must never abort the rest of the batch.
      out.errors.push(`${location?.title || locationId}: ${e.message}`);
    }
  }
  return out;
}

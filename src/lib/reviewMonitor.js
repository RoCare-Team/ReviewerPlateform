import Campaign from "../models/Campaign";
import GmbConnection from "../models/GmbConnection";
import GmbLocation from "../models/GmbLocation";
import Submission from "../models/Submission";
import { getValidAccessToken, listReviews } from "./gmb";
import { getSettings } from "./settings";
import { approveSubmission, unverifySubmission } from "./verification";

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
 * Two more guards sit on top of "complete", both aimed at the same failure:
 * a review that is briefly not there — Google re-indexing an edit, a listing
 * mid-update — costing a reviewer money they earned.
 *
 *   - AUTO_REVERSE_MIN_MISSES: it has to be absent on two separate complete
 *     reads, not one. A single unlucky read never costs anyone anything.
 *   - AUTO_REVERSE_MIN_HOURS: those reads have to be spread over roughly a
 *     day. Without this, an admin pressing "Check now" twice in five minutes
 *     would satisfy the count while proving nothing — two reads of the same
 *     momentary state are one observation, not two.
 *
 * And if it turns out to have been wrong anyway, it fixes itself: an
 * auto-reversed submission keeps being checked for AUTO_REVERSE_WATCH_DAYS,
 * and the moment the review is seen live again the reward is credited back
 * automatically (reviewRestoredAt). Nobody has to notice for the reviewer to
 * get their money.
 *
 * Every automatic reversal is recorded on the submission
 * (reviewAutoReversedAt) and stays listed for an admin, who can also approve
 * it again by hand.
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
 * Complete-read misses required before money moves, and the minimum age of
 * the first of them. See this module's docblock — together they mean "gone on
 * two separate days", which is what a real deletion looks like and a
 * re-indexing flicker does not. 20 hours, not 24, so a daily cron whose runs
 * drift slightly earlier still qualifies on the second day.
 */
export const AUTO_REVERSE_MIN_MISSES = 2;
export const AUTO_REVERSE_MIN_HOURS = 20;

/**
 * How long an automatically reversed submission keeps being re-checked, so a
 * review that comes back can credit the reviewer again. Long enough to cover
 * a listing that was down for a while; not forever, because a genuinely
 * deleted review never returns and re-reading it costs Google quota.
 */
export const AUTO_REVERSE_WATCH_DAYS = 30;

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
 * in the admin queue.
 *
 * Returns { outcome, completeStreak, missingSince }, where outcome is
 * "inconclusive" | "present" | "watching" (a conclusive miss that hasn't hit
 * the streak yet) | "missing" | "gone" (the submission stopped being approved
 * mid-run). The caller needs the streak and the age to decide whether the
 * evidence is strong enough to take money back — see runReviewRecheck.
 *
 * `complete` says the listing read accounted for every review Google claims
 * the listing has. A miss on an incomplete read still counts towards the
 * admin flag, but never towards the complete-read streak that money hangs on.
 *
 * Guarded on status:"approved" throughout — a submission an admin reversed
 * while this run was in flight must not get its monitoring fields rewritten.
 */
export async function recordReviewCheck(submissionId, { conclusive, present, reason, complete = false }) {
  const now = new Date();

  if (!conclusive) {
    // Deliberately does NOT touch the streak. A Google outage, an expired
    // token or a too-large listing must never accumulate towards accusing a
    // reviewer — it only records that we looked and why nothing came of it.
    await Submission.updateOne(
      { _id: submissionId, status: "approved" },
      { $set: { reviewCheckedAt: now, reviewCheckNote: reason } }
    );
    return { outcome: "inconclusive", completeStreak: 0, missingSince: null };
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
          reviewMissingCompleteStreak: 0,
          reviewMissingSince: null,
          reviewCheckNote: reason,
        },
      }
    );
    return { outcome: "present", completeStreak: 0, missingSince: null };
  }

  const sub = await Submission.findOneAndUpdate(
    { _id: submissionId, status: "approved" },
    {
      // Only a complete read moves the streak that money hangs on.
      $inc: { reviewMissingStreak: 1, ...(complete ? { reviewMissingCompleteStreak: 1 } : {}) },
      $set: { reviewCheckedAt: now, reviewCheckNote: reason },
    },
    { returnDocument: "after" }
  );
  if (!sub) return { outcome: "gone", completeStreak: 0, missingSince: null };

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

  return {
    outcome: sub.reviewMissingStreak >= MISSING_STREAK_TO_FLAG ? "missing" : "watching",
    completeStreak: sub.reviewMissingCompleteStreak || 0,
    missingSince: patch.reviewMissingSince ?? sub.reviewMissingSince ?? null,
  };
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
  const watchSince = new Date(Date.now() - AUTO_REVERSE_WATCH_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await Submission.find({
    gmbMatched: true,
    gmbReviewId: { $nin: ["", null] },
    // Two independent OR groups, so they go in $and — as sibling $or keys on
    // one object the second silently replaces the first, which dropped the
    // status filter entirely and pulled in pending submissions the run could
    // do nothing with.
    $and: [
      // Live submissions, PLUS the ones this run reversed by itself — those
      // keep being watched so a review that comes back can pay the reviewer
      // again without anyone noticing it went wrong. See the restore branch.
      {
        $or: [
          { status: "approved" },
          { status: "rejected", reviewAutoReversedAt: { $gte: watchSince } },
        ],
      },
      // Never checked, or not since the caller's cutoff. The ascending sort
      // below puts nulls (never checked) first, then the longest-unchecked, so
      // everything comes round eventually instead of the same few being
      // re-read every time.
      { $or: [{ reviewCheckedAt: null }, { reviewCheckedAt: { $lte: before } }] },
    ],
  })
    .sort({ reviewCheckedAt: 1 })
    .limit(limit)
    .select("campaign gmbReviewId reviewLiveStatus rewardAmount status reviewedAt reviewAutoReversedAt")
    .lean();

  const empty = { checked: 0, present: 0, missing: 0, watching: 0, inconclusive: 0, skipped: 0, reversed: 0, reclaimed: 0, restored: 0, errors: [] };
  if (candidates.length === 0) return empty;

  const settings = await getSettings();
  const autoReverseRemovedReviews = settings.autoReverseRemovedReviews;

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
        out.checked += 1;

        // --- Already reversed by us: the only question is whether it's back.
        if (sub.status === "rejected") {
          if (isPresent) {
            // The system was wrong, or the review returned. Either way the
            // reviewer earns it again — pay it back without waiting for anyone
            // to notice. approveSubmission re-takes the campaign slot too.
            try {
              const { outcome: restored, reward } = await approveSubmission(sub._id, settings.reviewerReward, {
                verifiedBy: "system",
                allowFrom: ["rejected"],
              });
              if (restored === "approved") {
                await Submission.updateOne(
                  { _id: sub._id },
                  {
                    $set: {
                      reviewAutoReversedAt: null,
                      reviewRestoredAt: new Date(),
                      reviewLiveStatus: "present",
                      reviewMissingStreak: 0,
                      reviewMissingCompleteStreak: 0,
                      reviewMissingSince: null,
                      reviewCheckedAt: new Date(),
                      reviewCheckNote: `Review is back on Google — ₹${reward} credited again automatically.`,
                    },
                  }
                );
                out.restored += 1;
                out.present += 1;
                continue;
              }
              // Couldn't re-approve (campaign full, or gone) — leave it for an
              // admin rather than silently pretending nothing happened.
              out.errors.push(`restore ${sub._id}: ${restored}`);
            } catch (e) {
              out.errors.push(`restore ${sub._id}: ${e.message}`);
            }
          }
          // Still gone, or unreadable: just record that we looked, so it
          // rotates to the back of the queue instead of being re-read hourly.
          await Submission.updateOne(
            { _id: sub._id },
            {
              $set: {
                reviewCheckedAt: new Date(),
                reviewCheckNote: live.ok
                  ? "Still not on the listing — reward stays reversed."
                  : `Couldn't confirm whether the reversed review is back — ${live.reason}`,
              },
            }
          );
          continue;
        }

        // --- Live submission: the normal path.
        const gone = live.ok && !isPresent;
        // A miss we may act on by ourselves, versus one that only means
        // "somebody should look at this".
        const provenGone = gone && live.complete;

        const { outcome, completeStreak, missingSince } = await recordReviewCheck(sub._id, {
          conclusive: live.ok,
          present: isPresent,
          complete: Boolean(live.complete),
          reason: live.ok
            ? isPresent
              ? "Review is still live on Google."
              : provenGone
                ? "Review is no longer on the business's Google listing."
                : `Review wasn't in the listing, but the read was incomplete — ${live.reason}`
            : live.reason,
        });
        if (outcome === "present") out.present += 1;
        else if (outcome === "missing") out.missing += 1;
        else if (outcome === "watching") out.watching += 1;
        else if (outcome === "inconclusive") out.inconclusive += 1;

        // Money moves only here, and only when every guard agrees: the read
        // saw the whole listing, the review has been absent from two of them,
        // and those two are a day apart rather than two clicks of "Check now".
        const missingLongEnough =
          missingSince && Date.now() - new Date(missingSince).getTime() >= AUTO_REVERSE_MIN_HOURS * 60 * 60 * 1000;
        const proven = provenGone && completeStreak >= AUTO_REVERSE_MIN_MISSES && missingLongEnough;

        if (proven && autoReverseRemovedReviews) {
          try {
            // recordReviewCheck ran first on purpose: it guards on status
            // "approved", which unverifySubmission is about to change.
            const result = await unverifySubmission(
              sub._id,
              "The review you were paid for is no longer on the business's Google listing, so the reward has been reversed. If it comes back, the reward is credited again automatically.",
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

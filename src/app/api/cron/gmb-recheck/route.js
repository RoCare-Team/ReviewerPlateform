import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import { verifyAgainstGmb } from "../../../../lib/gmbVerification";
import { approveSubmission, rejectSubmission } from "../../../../lib/verification";
import { AI_CONFIDENCE_THRESHOLD } from "../../../../lib/aiVerification";
import { getSettings } from "../../../../lib/settings";
import { recordCronRun } from "../../../../lib/cronLog";

/**
 * Retries the GMB cross-check for submissions the AI already approved but
 * that landed `pending` because Google hadn't shown the matching review yet
 * (gmbChecked=true, gmbMatched=false — see lib/gmbVerification.js). Google
 * typically surfaces a freshly posted review within 10-20 minutes, so a
 * submission that failed the check moments after being posted often passes
 * on a retry a bit later — this closes that gap automatically instead of
 * making every one of those wait on an admin.
 *
 * Meant to be hit by a scheduler (Vercel Cron via vercel.json, or any
 * external cron service) every 5-15 minutes — see vercel.json. Unauthenticated
 * by request — anyone who finds the URL can trigger it, but the worst it
 * does is re-run the same GMB match check this submission would already get
 * on its next legitimate retry, so an extra call just wastes a Google API
 * round trip rather than approving anything it shouldn't.
 *
 * Also resolves the two ways a candidate can become permanently un-checkable
 * instead of leaving it silently `pending` forever with nothing left to ever
 * pick it back up: its Campaign got deleted, or its reviewer's User account
 * got deleted. Either one is auto-rejected with a reason that says exactly
 * that, rather than sitting invisible in the queue with no path to
 * resolution (see `resolvedOrphans` in the response/cron log). One
 * candidate's own failure (a transient GMB API error, a malformed doc) is
 * caught per-item too, so it can't abort the rest of the batch.
 */
const BATCH_LIMIT = 25; // cap work per run so one invocation (or a spammed call) can't run long

export async function GET() {
  await dbConnect();

  try {
    const candidates = await Submission.find({
      status: "pending",
      aiDecision: "approve",
      aiConfidence: { $gte: AI_CONFIDENCE_THRESHOLD },
      gmbChecked: true,
      gmbMatched: false,
    })
      .sort({ createdAt: 1 }) // oldest first — they've had the most time for Google to catch up
      .limit(BATCH_LIMIT)
      .lean();

    if (candidates.length === 0) {
      await recordCronRun("gmb-recheck", { ok: true, result: { checked: 0, approved: 0 } });
      return Response.json({ ok: true, checked: 0, approved: 0 });
    }

    const settings = await getSettings();
    let approved = 0;
    let resolvedOrphans = 0;
    const runErrors = [];

    for (const sub of candidates) {
      try {
        // Re-fetch fresh each iteration — a prior loop iteration or a
        // concurrent request may have changed campaign/submission state
        // mid-run.
        const campaign = await Campaign.findById(sub.campaign);

        // The campaign is gone (deleted) — this submission can never be
        // resolved by anything past this point (no live doc to check
        // against, claim a slot on, or pay out of), so without this it sits
        // "pending" forever, silently skipped on every future run too. See
        // api/admin/campaigns/[id]'s DELETE, which now blocks deleting a
        // campaign that still has pending submissions — this is the
        // fallback for anything that slipped through before that guard, or
        // any other path that removes a campaign.
        if (!campaign) {
          const rejected = await rejectSubmission(sub._id, "The campaign this was submitted to no longer exists.", {
            verifiedBy: "system",
          });
          if (rejected) resolvedOrphans += 1;
          continue;
        }

        // Paused/draft/completed — not gone, just not accepting activity
        // right now. Leave it as-is; it'll be picked up again once (if) the
        // campaign goes back to active. This is a genuine "wait", not a
        // stuck state, since the campaign still exists to check against.
        if (campaign.status !== "active") continue;

        const reviewerUser = await User.findById(sub.reviewer).select("name");
        // The reviewer account is gone — same "nothing can ever resolve
        // this" reasoning as the missing-campaign case above, just for the
        // other side of the submission.
        if (!reviewerUser) {
          const rejected = await rejectSubmission(sub._id, "The reviewer account for this submission no longer exists.", {
            verifiedBy: "system",
          });
          if (rejected) resolvedOrphans += 1;
          continue;
        }

        const gmb = await verifyAgainstGmb({ campaign, reviewerUser });

        // Record the latest verdict regardless of outcome, so the admin
        // queue always shows the most recent check, not a stale one from
        // submit time.
        await Submission.updateOne(
          { _id: sub._id, status: "pending" },
          {
            $set: {
              gmbChecked: gmb.checked,
              gmbMatched: gmb.matched,
              gmbReviewId: gmb.reviewId || "",
              gmbReason: gmb.reason,
            },
          }
        );

        if (gmb.matched) {
          const { outcome } = await approveSubmission(sub._id, settings.reviewerReward, { verifiedBy: "ai" });
          if (outcome === "approved") approved += 1;
        }
      } catch (e) {
        // One submission's failure (a malformed doc, a transient GMB API
        // error) must never abort the whole batch — every other candidate
        // in this run still deserves its own check.
        runErrors.push(`${sub._id}: ${e.message}`);
      }
    }

    await recordCronRun("gmb-recheck", {
      ok: true,
      result: { checked: candidates.length, approved, resolvedOrphans, errors: runErrors },
    });
    return Response.json({ ok: true, checked: candidates.length, approved, resolvedOrphans, errors: runErrors });
  } catch (e) {
    await recordCronRun("gmb-recheck", { ok: false, error: e.message });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

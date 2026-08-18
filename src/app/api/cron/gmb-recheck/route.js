import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import { verifyAgainstGmb } from "../../../../lib/gmbVerification";
import { approveSubmission } from "../../../../lib/verification";
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

    for (const sub of candidates) {
      // Re-fetch fresh each iteration — a prior loop iteration or a concurrent
      // request may have changed campaign/submission state mid-run.
      const campaign = await Campaign.findById(sub.campaign);
      if (!campaign || campaign.status !== "active") continue;

      const reviewerUser = await User.findById(sub.reviewer).select("name");
      if (!reviewerUser) continue;

      const gmb = await verifyAgainstGmb({ campaign, reviewerUser });

      // Record the latest verdict regardless of outcome, so the admin queue
      // always shows the most recent check, not a stale one from submit time.
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
    }

    await recordCronRun("gmb-recheck", { ok: true, result: { checked: candidates.length, approved } });
    return Response.json({ ok: true, checked: candidates.length, approved });
  } catch (e) {
    await recordCronRun("gmb-recheck", { ok: false, error: e.message });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

import dbConnect from "../../../../lib/db";
import { runReviewRecheck } from "../../../../lib/reviewMonitor";
import { recordCronRun } from "../../../../lib/cronLog";

/**
 * Re-checks reviews the platform has ALREADY PAID for: are they still on the
 * business's Google listing?
 *
 * A reviewer is paid the moment their submission is approved. Nothing after
 * that point ever looked at the review again, so a reviewer could post, get
 * paid, and delete the review an hour later — or Google could filter it out —
 * and the business would be short a review it paid ₹100 for with no trace of
 * why. This run closes that hole.
 *
 * It never reverses a reward. A conclusive disappearance, seen
 * MISSING_STREAK_TO_FLAG times in a row, flips the submission's
 * reviewLiveStatus to "missing", which surfaces it at /admin/removed-reviews
 * for an admin to reverse (clawing the reward back out of the reviewer's
 * wallet) or dismiss. See lib/reviewMonitor.js for why an automatic clawback
 * would be the wrong call here.
 *
 * The work itself lives in lib/reviewMonitor.js#runReviewRecheck, shared with
 * the admin panel's "Check now" button (api/admin/review-recheck). All this
 * route decides is the SCHEDULE: one batch, over submissions not looked at in
 * the last RECHECK_AFTER_HOURS.
 *
 * Meant for a scheduler (Vercel Cron, see vercel.json) hourly. Unauthenticated
 * by request, same as the other cron routes here — the worst an extra call
 * does is spend a few Google API reads and update `reviewCheckedAt` early; it
 * cannot move money, and flagging still needs two independent conclusive
 * misses spaced a day apart.
 */
const RECHECK_AFTER_HOURS = 24; // don't look at the same submission more often than this

export async function GET() {
  await dbConnect();

  try {
    const before = new Date(Date.now() - RECHECK_AFTER_HOURS * 60 * 60 * 1000);
    const result = await runReviewRecheck({ before });
    await recordCronRun("review-recheck", { ok: true, result });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    await recordCronRun("review-recheck", { ok: false, error: e.message });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import { getCurrentUser } from "../../../../lib/auth/session";
import { ROLES } from "../../../../lib/auth/roles";
import { runReviewRecheck } from "../../../../lib/reviewMonitor";
import { recordCronRun } from "../../../../lib/cronLog";

/**
 * "Check now" from /admin/removed-reviews — the same recheck the hourly cron
 * runs (api/cron/review-recheck), but swept on demand instead of trickled.
 *
 * The only difference is the schedule, which is the caller's to pick (see
 * lib/reviewMonitor.js#runReviewRecheck): the cron looks at submissions not
 * checked in the last 24h, this passes the moment the sweep STARTED, so
 * every eligible submission is looked at once regardless of when it was last
 * seen — and the sweep terminates, because each check stamps a time later
 * than that cutoff.
 *
 * Why an admin needs this at all: flagging deliberately requires two
 * conclusive misses, and the cron won't re-check the same submission for a
 * day. Straight after the first ever pass, everything sits at one miss and
 * the queue looks empty for 24 hours. This lets an admin do the second pass
 * now. It's still two independent reads of Google, just closer together.
 *
 * Admin-only, unlike the cron route: this ignores the pacing that keeps the
 * unauthenticated endpoint cheap, and it can put rows in front of an admin
 * that end in money being taken back.
 *
 * Bounded by wall clock and batch count rather than run to completion — a
 * serverless function has a request timeout, and a listing with hundreds of
 * reviews takes several Google round trips. It reports how far it got and
 * whether anything is left, so the button can simply be pressed again.
 */
const TIME_BUDGET_MS = 45_000;
const MAX_BATCHES = 40;

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN || user.status !== "active") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  // Captured once, before any work: this is what makes the sweep finite.
  const before = new Date();
  const startedAt = Date.now();
  const total = { checked: 0, present: 0, missing: 0, watching: 0, inconclusive: 0, skipped: 0, reversed: 0, reclaimed: 0, errors: [] };
  let batches = 0;
  let done = false;

  try {
    while (batches < MAX_BATCHES && Date.now() - startedAt < TIME_BUDGET_MS) {
      const batch = await runReviewRecheck({ before });
      batches += 1;
      if (batch.checked === 0 && batch.skipped === 0) {
        done = true;
        break;
      }
      for (const k of ["checked", "present", "missing", "watching", "inconclusive", "skipped", "reversed", "reclaimed"]) {
        total[k] += batch[k];
      }
      total.errors.push(...batch.errors);
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }

  // Logged against the same job as the cron so /admin/cron-status shows the
  // real last run, whoever triggered it.
  await recordCronRun("review-recheck", { ok: true, result: { ...total, manual: true } });

  // The queue count after the sweep is what the admin actually came for.
  const flagged = await Submission.countDocuments({ status: "approved", reviewLiveStatus: "missing" });

  return Response.json({ ok: true, ...total, batches, done, flagged });
}

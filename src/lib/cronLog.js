import dbConnect from "./db";
import CronLog from "../models/CronLog";

/**
 * Records that a cron route actually ran, so /api/admin/cron/status can tell
 * a real "it's just quiet right now" apart from "Vercel stopped calling it" —
 * something application logs alone don't answer, since the recheck route
 * legitimately returns `checked: 0` on every quiet run.
 */
export async function recordCronRun(job, { ok = true, error = "", result = null } = {}) {
  await dbConnect();
  await CronLog.findOneAndUpdate(
    { job },
    {
      $set: { lastRunAt: new Date(), lastOk: ok, lastError: error, lastResult: result },
      $inc: { runCount: 1 },
    },
    { upsert: true }
  );
}

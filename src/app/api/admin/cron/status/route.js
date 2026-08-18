import dbConnect from "../../../../../lib/db";
import CronLog from "../../../../../models/CronLog";
import { apiRequireAdmin } from "../../../../../lib/auth/guards";

/**
 * "Is my cron actually running?" — for admin, without digging through Vercel's
 * dashboard. Every hit to /api/cron/* writes a CronLog row on the way out (see
 * lib/cronLog.js), so this just reads those rows back and flags any job whose
 * last run is older than ~3x its own schedule interval as "down" — a single
 * missed tick (Vercel retries, cold starts) shouldn't cry wolf, but 3+ misses
 * in a row means the scheduler genuinely isn't calling it.
 *
 * Expected interval is hardcoded here rather than read from vercel.json (not
 * available at runtime) — keep this in sync with vercel.json's `schedule` if
 * either changes.
 */
const EXPECTED = {
  "gmb-recheck": 10, // minutes — vercel.json: */10 * * * *
  "gmb-auto-reply": 15, // minutes — vercel.json: */15 * * * *
};
const MISSED_TICKS_BEFORE_DOWN = 3;

export async function GET() {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  await dbConnect();
  const logs = await CronLog.find({}).lean();
  const byJob = new Map(logs.map((l) => [l.job, l]));

  const jobs = Object.entries(EXPECTED).map(([job, expectedMinutes]) => {
    const log = byJob.get(job);
    if (!log) {
      return {
        job,
        status: "never_run",
        expectedEveryMinutes: expectedMinutes,
        lastRunAt: null,
        minutesSinceLastRun: null,
        lastOk: null,
        lastError: "",
        runCount: 0,
      };
    }

    const minutesSince = Math.round((Date.now() - new Date(log.lastRunAt).getTime()) / 60000);
    const overdue = minutesSince > expectedMinutes * MISSED_TICKS_BEFORE_DOWN;
    const status = overdue ? "down" : log.lastOk ? "healthy" : "erroring";

    return {
      job,
      status,
      expectedEveryMinutes: expectedMinutes,
      lastRunAt: log.lastRunAt,
      minutesSinceLastRun: minutesSince,
      lastOk: log.lastOk,
      lastError: log.lastError || "",
      lastResult: log.lastResult,
      runCount: log.runCount,
    };
  });

  const allHealthy = jobs.every((j) => j.status === "healthy");
  return Response.json({ ok: allHealthy, jobs });
}

import dbConnect from "./db";
import CronLog from "../models/CronLog";

/**
 * Shared by /api/admin/cron/status (JSON) and /admin/cron-status (the admin
 * panel page) so the "is it down" threshold lives in exactly one place.
 * Expected interval is hardcoded here rather than read from vercel.json (not
 * available at runtime) — keep this in sync with vercel.json's `schedule` if
 * either changes.
 */
const EXPECTED = {
  "gmb-recheck": 10, // minutes — vercel.json: */10 * * * *
  "gmb-auto-reply": 15, // minutes — vercel.json: */15 * * * *
};
const MISSED_TICKS_BEFORE_DOWN = 3;

export async function getCronStatus() {
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
        lastResult: null,
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

  return jobs;
}

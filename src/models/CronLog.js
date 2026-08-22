import mongoose from "mongoose";

/**
 * One row per cron job (upserted, not appended) — "job" is a stable key like
 * "gmb-recheck" matching the route name in vercel.json. Every GET to a cron
 * route updates its row's `lastRunAt`/`lastResult` on the way out (success or
 * error), so /api/admin/cron/status can answer "is it actually running?"
 * without guessing from application side-effects.
 */
const CronLogSchema = new mongoose.Schema(
  {
    job: { type: String, required: true, unique: true, index: true },
    lastRunAt: { type: Date, required: true },
    lastOk: { type: Boolean, required: true, default: true },
    lastError: { type: String, default: "" },
    lastResult: { type: mongoose.Schema.Types.Mixed, default: null },
    runCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.CronLog || mongoose.model("CronLog", CronLogSchema);

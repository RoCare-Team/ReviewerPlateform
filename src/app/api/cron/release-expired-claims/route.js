import dbConnect from "../../../../lib/db";
import Campaign from "../../../../models/Campaign";
import { releaseExpiredClaims } from "../../../../lib/claims";
import { recordCronRun } from "../../../../lib/cronLog";

/**
 * Sweeps every active campaign's expired claims (see
 * lib/claims.js#releaseExpiredClaims) — the ONLY place that deletes an
 * expired Claim doc and decrements Campaign.claimed together, atomically.
 * That already runs opportunistically (before every claim attempt, and for
 * every campaign a reviewer's campaigns-list page loads), which covers the
 * common case fast; this cron is the backstop for a campaign nobody happens
 * to browse for a while, so an abandoned claim's slot doesn't sit reserved-
 * but-unusable indefinitely just because no one's page load triggered the
 * cleanup.
 *
 * This didn't always run — Claim.expiresAt used to also carry a native
 * MongoDB TTL index, which let Mongo's own background sweep delete an
 * expired claim a beat before this app-level cleanup got to it. Whichever
 * deleted the doc first "won"; if Mongo won, releaseExpiredClaims() found
 * nothing left to act on and never decremented `claimed` — a real slot
 * leaked, permanently, with no way to reclaim it short of a manual fix. That
 * TTL index is gone now (see models/Claim.js's docblock); this cron plus the
 * opportunistic calls are the only things that ever expire a claim.
 */
const BATCH_LIMIT = 200; // generous — this is cheap per campaign, just a few queries

export async function GET() {
  await dbConnect();

  try {
    const campaigns = await Campaign.find({ status: "active" }).select("_id").limit(BATCH_LIMIT).lean();

    let errors = 0;
    for (const c of campaigns) {
      try {
        await releaseExpiredClaims(c._id);
      } catch {
        errors += 1; // one campaign's failure never blocks the rest
      }
    }

    await recordCronRun("release-expired-claims", { ok: true, result: { campaigns: campaigns.length, errors } });
    return Response.json({ ok: true, campaigns: campaigns.length, errors });
  } catch (e) {
    await recordCronRun("release-expired-claims", { ok: false, error: e.message });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

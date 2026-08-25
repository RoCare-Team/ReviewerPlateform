import dbConnect from "../../../../../../lib/db";
import Submission from "../../../../../../models/Submission";
import Claim from "../../../../../../models/Claim";
import { apiRequirePermission } from "../../../../../../lib/auth/guards";
import { claimSlot, releaseClaim } from "../../../../../../lib/claims";
import { checkReviewerDailyLimit, REVIEWER_DAILY_SUBMISSION_LIMIT } from "../../../../../../lib/pacing";

/**
 * Reserve a review slot on a campaign and hand back the review link — the
 * only place the link is revealed to a reviewer. Called when they click
 * "Open review link", before they ever see the actual Google review URL, so
 * a campaign that only needs a handful of reviews can't be started by more
 * reviewers than it has slots for. See src/lib/claims.js for the reservation
 * logic and src/models/Claim.js for why this is time-limited.
 */
export async function POST(request, { params }) {
  const { user, response } = await apiRequirePermission("feedback:submit");
  if (response) return response;

  const { id: campaignId } = await params;
  if (!campaignId) return Response.json({ error: "Campaign is required." }, { status: 400 });

  await dbConnect();

  // Already submitted (live) — no new claim needed, nothing to reserve.
  const existingSub = await Submission.findOne({ campaign: campaignId, reviewer: user.id });
  if (existingSub && existingSub.status !== "rejected") {
    return Response.json({ error: "You've already submitted for this campaign." }, { status: 409 });
  }

  // Platform-wide cap — see lib/pacing.js#checkReviewerDailyLimit. Checked
  // here (before the link is even revealed) so a reviewer who's already hit
  // today's limit never gets as far as opening it; api/reviewer/submissions
  // re-checks at actual submit time too, since a claim reserved just before
  // midnight could otherwise slip a 3rd submission through after it rolls over.
  const { blocked } = await checkReviewerDailyLimit(user.id);
  if (blocked) {
    return Response.json(
      { error: `You've reached today's limit of ${REVIEWER_DAILY_SUBMISSION_LIMIT} reviews. Try again tomorrow.` },
      { status: 400 }
    );
  }

  const result = await claimSlot(campaignId, user.id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  // A human-quotable reference for the reservation the reviewer now holds —
  // the Claim's own id, so support can look up an exact reservation from a
  // screenshot of the app's "Slot booked" screen. claimSlot() doesn't return
  // it (the web UI has no use for one), so it's read back here.
  const claim = await Claim.findOne({ campaign: campaignId, reviewer: user.id }).select("_id").lean();

  return Response.json({
    ok: true,
    slotId: claim ? String(claim._id) : "",
    targetUrl: result.targetUrl,
    expiresAt: result.expiresAt,
    reviewText: result.reviewText,
    imageUrl: result.imageUrl,
  });
}

/**
 * Give a reserved slot back before it expires — the "Cancel slot" action.
 *
 * `keepReserved: false` is the whole point here: the reviewer is abandoning
 * the claim WITHOUT a submission, so the campaign's `claimed` counter has to
 * come back down (and the assigned review draft/image return to the pool),
 * otherwise the slot stays spoken for forever. The default (`true`) is for
 * the other caller — api/reviewer/submissions, where the claim became a
 * pending Submission and the slot must stay reserved until it's decided.
 *
 * Safe to call when there is no live claim: releaseClaim() finds nothing to
 * delete and does nothing, so a double tap or a retry can't decrement
 * Campaign.claimed twice.
 */
export async function DELETE(_request, { params }) {
  const { user, response } = await apiRequirePermission("feedback:submit");
  if (response) return response;

  const { id: campaignId } = await params;
  if (!campaignId) return Response.json({ error: "Campaign is required." }, { status: 400 });

  await dbConnect();
  await releaseClaim(campaignId, user.id, { keepReserved: false });

  return Response.json({ ok: true });
}

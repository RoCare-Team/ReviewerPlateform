import dbConnect from "../../../../../../lib/db";
import Submission from "../../../../../../models/Submission";
import { apiRequirePermission } from "../../../../../../lib/auth/guards";
import { claimSlot } from "../../../../../../lib/claims";
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

  return Response.json({
    ok: true,
    targetUrl: result.targetUrl,
    expiresAt: result.expiresAt,
    reviewText: result.reviewText,
    imageUrl: result.imageUrl,
  });
}

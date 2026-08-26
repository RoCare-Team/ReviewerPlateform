import { apiRequirePermission } from "../../../../lib/auth/guards";
import { getAvailableCampaignsForReviewer, getReviewerCooldownState } from "../../../../lib/reviewerCampaigns";

/**
 * The campaigns this reviewer can actually join right now.
 *
 * A thin REST wrapper around the SAME function the website's
 * /reviewer/campaigns page calls (src/lib/reviewerCampaigns.js), so the mobile
 * list can never drift from the web one: slot maths, city matching, drip
 * pacing, resubmission-after-rejection and the reviewer's own live claim are
 * all resolved in that one place.
 *
 * City comes from the reviewer's stored `location.city` (set at signup, changed
 * via POST /api/reviewer/location) — deliberately NOT from a `?city=` query
 * param, so a client can't hand itself campaigns for a city it isn't in. A
 * client that sends one is simply ignored.
 *
 * The review link is deliberately NOT in this payload — it is only revealed by
 * POST /api/reviewer/campaigns/[id]/claim, once a slot is actually reserved.
 *
 * `cooldown` rides along so the app can grey out its own "Book slot" button
 * and show the wait, instead of finding out only when the claim call comes
 * back 400. The campaigns themselves are still listed during a cooldown —
 * the reviewer can see what's waiting, just not start it yet.
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("feedback:submit");
  if (response) return response;

  const [campaigns, cooldown] = await Promise.all([
    getAvailableCampaignsForReviewer(user.id),
    getReviewerCooldownState(user.id),
  ]);
  return Response.json({ campaigns, cooldown });
}

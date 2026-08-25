import { apiRequirePermission } from "../../../../lib/auth/guards";
import { getAvailableCampaignsForReviewer } from "../../../../lib/reviewerCampaigns";

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
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("feedback:submit");
  if (response) return response;

  const campaigns = await getAvailableCampaignsForReviewer(user.id);
  return Response.json({ campaigns });
}

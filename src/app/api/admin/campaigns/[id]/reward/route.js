import { z } from "zod";
import dbConnect from "../../../../../../lib/db";
import Campaign from "../../../../../../models/Campaign";
import { apiRequireAdmin } from "../../../../../../lib/auth/guards";

/**
 * Admin-only override of what a REVIEWER earns per verified review on ONE
 * specific campaign — independent of the campaign's `ratePerReview` (what
 * the business pays IN) and independent of the global
 * AppSettings.reviewerReward (lib/settings.js) every other campaign still
 * uses by default. See Campaign.reviewerReward and lib/verification.js's
 * approveSubmission() for how the override is resolved at payout time.
 *
 * Never exposed to the business owner — they fund the campaign, they don't
 * set reviewer payout policy. Only ever reachable from the admin campaigns
 * list.
 *
 * Body: { reviewerReward: number | null }. `null` clears the override, so
 * the campaign falls back to the global rate again.
 */
const schema = z
  .object({
    reviewerReward: z.number().int().positive().max(100_000).nullable(),
  })
  .strict();

export async function PATCH(request, { params }) {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid reward amount, or clear it." }, { status: 400 });
  }

  await dbConnect();

  const campaign = await Campaign.findByIdAndUpdate(
    id,
    { $set: { reviewerReward: parsed.data.reviewerReward } },
    { returnDocument: "after" }
  ).select("reviewerReward");

  if (!campaign) return Response.json({ error: "Campaign not found." }, { status: 404 });

  return Response.json({ ok: true, reviewerReward: campaign.reviewerReward });
}

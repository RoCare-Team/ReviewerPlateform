import { z } from "zod";
import dbConnect from "../../../../../../lib/db";
import Campaign from "../../../../../../models/Campaign";
import { apiRequireAdmin } from "../../../../../../lib/auth/guards";

/**
 * Admin-only campaign status control — unlike the business owner's own
 * pause/reopen toggle (api/business/campaigns/[id]/route.js, scoped to
 * `user: user.id`), this reaches ANY campaign regardless of who owns it.
 * Same underlying effect either way: `status: "active"` is the only value
 * the reviewer dashboard and submission route accept, so flipping a campaign
 * out of it immediately hides it from reviewers and blocks new submissions
 * (see Campaign.status's comment).
 *
 * "activate" only works from "paused" (never resurrects a "completed" or
 * "draft" campaign — those need the owner's own edit flow, not an admin
 * status flip). "pause" only works from "active". Same one-step-at-a-time
 * guard as the business owner's toggle, just without the ownership scope.
 */
const schema = z.object({ action: z.enum(["pause", "activate"]) }).strict();

export async function PATCH(request, { params }) {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  await dbConnect();

  const from = parsed.data.action === "pause" ? "active" : "paused";
  const to = parsed.data.action === "pause" ? "paused" : "active";

  const campaign = await Campaign.findOneAndUpdate(
    { _id: id, status: from },
    { $set: { status: to } },
    { returnDocument: "after" }
  ).select("status");

  if (!campaign) {
    return Response.json(
      {
        error:
          parsed.data.action === "pause"
            ? "Only an active campaign can be deactivated."
            : "Only a paused campaign can be reactivated.",
      },
      { status: 409 }
    );
  }

  return Response.json({ ok: true, status: campaign.status });
}

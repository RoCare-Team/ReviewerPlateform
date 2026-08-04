import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import Campaign from "../../../../../models/Campaign";
import { apiRequirePermission } from "../../../../../lib/auth/guards";

/**
 * Close ("pause") or reopen ("activate") one of the business owner's own
 * campaigns. Guarded by campaign:* , scoped to `user: user.id` so a business
 * can never touch another account's campaign by guessing an id.
 *
 * Pausing sets status: "paused" — the reviewer dashboard only lists
 * `Campaign.find({ status: "active" })` and the submission route itself
 * rejects proof for a non-active campaign, so a paused campaign disappears
 * from the reviewer side and can no longer accept new submissions,
 * immediately and without touching any reviewer-facing code.
 *
 * A completed/draft campaign can't be toggled here — only active <-> paused.
 */
const schema = z.object({ action: z.enum(["pause", "activate"]) }).strict();

export async function PATCH(request, { params }) {
  const { user, response } = await apiRequirePermission("campaign:update");
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const from = parsed.data.action === "pause" ? "active" : "paused";
  const to = parsed.data.action === "pause" ? "paused" : "active";

  await dbConnect();

  const campaign = await Campaign.findOneAndUpdate(
    { _id: id, user: user.id, status: from },
    { $set: { status: to } },
    { returnDocument: "after" }
  ).lean();

  if (!campaign) {
    return Response.json(
      { error: parsed.data.action === "pause" ? "Only an active campaign can be closed." : "Only a closed campaign can be reopened." },
      { status: 409 }
    );
  }

  return Response.json({ ok: true, campaign });
}

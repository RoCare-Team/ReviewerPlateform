import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import Campaign from "../../../../../models/Campaign";
import GmbLocation from "../../../../../models/GmbLocation";
import User from "../../../../../models/User";
import WalletTransaction from "../../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../../lib/auth/guards";

/**
 * Two things happen through this route for one of the business owner's own
 * campaigns, guarded by campaign:* and scoped to `user: user.id` so a
 * business can never touch another account's campaign by guessing an id:
 *
 * 1. Close ("pause") / reopen ("activate"). Pausing sets status: "paused" —
 *    the reviewer dashboard only lists `Campaign.find({ status: "active" })`
 *    and the submission route itself rejects proof for a non-active
 *    campaign, so a paused campaign disappears from the reviewer side and
 *    can no longer accept new submissions, immediately. A completed/draft
 *    campaign can't be toggled — only active <-> paused.
 *
 * 2. Edit the campaign — name/notes/targetUrl/city/location freely, plus
 *    targetReviews, which re-prices the campaign at its EXISTING
 *    ratePerReview (the rate itself is never editable here) and
 *    debits/refunds the wallet for the difference, atomically, the same way
 *    campaign creation debits it (see api/business/campaigns/route.js). A
 *    reduction can never drop targetReviews below what's already been
 *    `collected`, and an increase can never exceed the wallet balance.
 *    Deliberately still NOT editable: ratePerReview (admin-controlled),
 *    platform (reviewer-side matching differs per platform), reviewerReward
 *    (admin-only), status (has its own action above), and collected/claimed
 *    (driven by reviewer activity). Blocked entirely once "completed".
 */
const toggleSchema = z.object({ action: z.enum(["pause", "activate"]) }).strict();
const editSchema = z
  .object({
    action: z.literal("edit"),
    name: z.string().trim().min(1, "Give your campaign a name.").max(200),
    notes: z.string().trim().max(1000).optional().default(""),
    targetUrl: z.union([z.string().trim().url(), z.literal("")]).optional().default(""),
    city: z.string().trim().max(200).optional().default(""),
    reviews: z.number().int().min(1).max(1_000_000),
    locationId: z.string().trim().optional().default(""),
  })
  .strict();
const schema = z.union([toggleSchema, editSchema]);

export async function PATCH(request, { params }) {
  const { user, response } = await apiRequirePermission("campaign:update");
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await dbConnect();

  if (parsed.data.action === "edit") {
    return editCampaign(id, user, parsed.data);
  }

  const from = parsed.data.action === "pause" ? "active" : "paused";
  const to = parsed.data.action === "pause" ? "paused" : "active";

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

async function editCampaign(id, user, data) {
  const { name, notes, targetUrl, city, reviews, locationId } = data;

  const existing = await Campaign.findOne({ _id: id, user: user.id, status: { $ne: "completed" } });
  if (!existing) {
    return Response.json({ error: "Campaign not found, or it's already completed." }, { status: 409 });
  }

  if (reviews < existing.collected) {
    return Response.json(
      { error: `Target can't go below ${existing.collected} — that many reviews are already collected.` },
      { status: 400 }
    );
  }

  let locationDoc = null;
  if (locationId) {
    locationDoc = await GmbLocation.findOne({ _id: locationId, user: user.id });
    if (!locationDoc) return Response.json({ error: "Location not found." }, { status: 400 });
  }

  const newBudget = reviews * existing.ratePerReview;
  const diff = newBudget - existing.budget; // > 0 needs more funds, < 0 refunds the difference

  if (diff !== 0) {
    // Same atomic conditional debit/credit pattern as creation — only
    // applies if the balance actually covers an increase, and a decrease
    // just credits back the unspent difference.
    const walletUpdate =
      diff > 0
        ? await User.findOneAndUpdate(
            { _id: user.id, walletBalance: { $gte: diff } },
            { $inc: { walletBalance: -diff } },
            { returnDocument: "after" }
          ).select("walletBalance")
        : await User.findOneAndUpdate(
            { _id: user.id },
            { $inc: { walletBalance: -diff } },
            { returnDocument: "after" }
          ).select("walletBalance");

    if (!walletUpdate) {
      return Response.json({ error: "Insufficient wallet balance to increase the target." }, { status: 400 });
    }

    await WalletTransaction.create({
      user: user.id,
      amount: -diff,
      type: diff > 0 ? "spend" : "refund",
      note: `Campaign updated: ${name}`,
      balanceAfter: walletUpdate.walletBalance,
    });
  }

  existing.name = name;
  existing.notes = notes;
  existing.targetUrl = targetUrl;
  existing.city = city;
  existing.targetReviews = reviews;
  existing.budget = newBudget;
  if (locationDoc) existing.location = locationDoc._id;
  await existing.save();

  return Response.json({ ok: true, campaign: existing });
}

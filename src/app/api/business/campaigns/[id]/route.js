import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import Campaign from "../../../../../models/Campaign";
import GmbLocation from "../../../../../models/GmbLocation";
import User from "../../../../../models/User";
import WalletTransaction from "../../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { canonicalizeCity } from "../../../../../lib/campaigns";

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
 *    `reviewDrafts`, if sent, REPLACES the campaign's UNASSIGNED
 *    review-draft pool only — any entry already claimed by a reviewer
 *    (assignedTo set) is left exactly as-is, never touched by this route.
 *    Same optional-field shape as creation (EditCampaignModal.jsx), letting
 *    the owner add a first batch of AI-drafted reviews to a campaign that
 *    never had any, not just edit ones that already exist.
 *    Deliberately still NOT editable: ratePerReview (admin-controlled),
 *    platform (reviewer-side matching differs per platform), reviewerReward
 *    (admin-only), status (has its own action above), and collected/claimed
 *    (driven by reviewer activity). Blocked entirely once "completed".
 */
const toggleSchema = z.object({ action: z.enum(["pause", "activate"]) }).strict();
// Same shape as api/business/campaigns/route.js's reviewDraftSchema — kept
// as its own copy rather than a shared import since the two routes' schemas
// are otherwise independent and this is small.
const reviewDraftSchema = z.union([
  z.string().trim().min(1).max(1000),
  z.object({ text: z.string().trim().min(1).max(1000), keyword: z.string().trim().max(100).optional().default("") }),
]);
const editSchema = z
  .object({
    action: z.literal("edit"),
    name: z.string().trim().min(1, "Give your campaign a name.").max(200),
    notes: z.string().trim().max(1000).optional().default(""),
    targetUrl: z.union([z.string().trim().url(), z.literal("")]).optional().default(""),
    // Replaces the old single `city` field — see models/Campaign.js's `city`
    // vs `cities` and lib/campaigns.js#campaignCities.
    cities: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
    reviews: z.number().int().min(1).max(1_000_000),
    locationId: z.string().trim().optional().default(""),
    // Optional — omitted entirely means "leave the draft pool as-is" (see
    // editCampaign() below); sent as `[]` explicitly clears the unassigned
    // pool down to nothing.
    reviewDrafts: z.array(reviewDraftSchema).max(200).optional(),
    // Same optional/replace-unassigned-only treatment as reviewDrafts, for
    // the image pool. URLs only — already uploaded via
    // /api/business/campaigns/upload-image before this request.
    reviewImages: z.array(z.string().trim().url()).max(200).optional(),
  })
  .strict();
const schema = z.union([toggleSchema, editSchema]);

function normalizeDrafts(drafts) {
  return (drafts ?? []).map((d) => (typeof d === "string" ? { text: d, keyword: "" } : d));
}

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
  const { name, notes, targetUrl, cities, reviews, locationId, reviewDrafts, reviewImages } = data;

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
  // The edit form always submits the new multi-city picker's value — clear
  // the legacy single `city` field too, so it can't linger and win the
  // fallback in lib/campaigns.js#campaignCities() after the owner has
  // explicitly emptied the city list here.
  existing.cities = [...new Set(cities.map((c) => canonicalizeCity(c)).filter(Boolean))];
  existing.city = "";
  existing.targetReviews = reviews;
  existing.budget = newBudget;

  // Omitted entirely → leave the pool untouched. Sent (even as `[]`) →
  // replace the UNASSIGNED portion only; anything already assigned to a
  // reviewer's live claim stays exactly where it is, unedited and
  // unremoved — see this route's docblock and EditCampaignModal.jsx's
  // initialKeywords().
  if (reviewDrafts !== undefined) {
    const assigned = existing.reviewDrafts.filter((d) => d.assignedTo);
    const fresh = normalizeDrafts(reviewDrafts).map((d) => ({ ...d, assignedTo: null, assignedAt: null }));
    existing.reviewDrafts = [...assigned, ...fresh];
  }
  // Same treatment, same reasoning, for the image pool.
  if (reviewImages !== undefined) {
    const assignedImages = existing.reviewImages.filter((im) => im.assignedTo);
    const freshImages = reviewImages.map((url) => ({ url, assignedTo: null, assignedAt: null }));
    existing.reviewImages = [...assignedImages, ...freshImages];
  }

  if (locationDoc) {
    existing.location = locationDoc._id;
    // Re-snapshot — see models/Campaign.js's businessName/businessCategory.
    // Switching to a different location should update these too, not leave
    // them pointing at whatever the PREVIOUS location was called.
    existing.businessName = locationDoc.title || "";
    existing.businessCategory = locationDoc.category || "";
  }
  await existing.save();

  return Response.json({ ok: true, campaign: existing });
}

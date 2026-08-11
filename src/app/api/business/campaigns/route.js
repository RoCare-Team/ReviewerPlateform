import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import Campaign from "../../../../models/Campaign";
import GmbLocation from "../../../../models/GmbLocation";
import WalletTransaction from "../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { approxReviews } from "../../../../lib/campaigns";
import { getSettings } from "../../../../lib/settings";

/**
 * Create / list campaigns. Guarded by campaign:* (business owners), scoped to the
 * session user. Creating a campaign DEDUCTS its budget from the wallet atomically
 * (a conditional $inc that only applies if the balance is sufficient), records a
 * spend ledger entry, and computes targetReviews = floor(budget / ₹100).
 *
 * Two request shapes:
 *  - Single campaign (any platform): { name, platform, budget, notes, targetUrl, locationId }.
 *  - Multi-location batch, Google only: { name, platform: "google", notes, locations: [{locationId, budget, targetUrl?}, ...] }
 *    — one Campaign doc per selected location, each with its own budget slice.
 *    targetUrl defaults to that location's synced GmbLocation.reviewUrl but the
 *    owner can override it per location. The whole batch is funded by a single
 *    atomic wallet debit (sum of the per-location budgets) so it can't
 *    partially succeed against the wallet.
 */
const locationItemSchema = z.object({
  locationId: z.string().min(1),
  budget: z.number().int().positive().max(10_000_000),
  // Defaults to the location's own synced reviewUrl when omitted — this lets
  // the owner override it per-location (see createBatch below).
  targetUrl: z.string().trim().max(500).optional(),
  // Defaults to the city parsed from the location's own address when
  // omitted — same override pattern as targetUrl.
  city: z.string().trim().max(120).optional(),
  // This location's slice of the AI-drafted (or owner-written) review pool —
  // see models/Campaign.js reviewDrafts.
  reviewDrafts: z.array(z.string().trim().min(1).max(1000)).max(200).optional(),
});

const createSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    platform: z.enum(["google", "trustpilot", "capterra", "amazon", "playstore"]).default("google"),
    budget: z.number().int().positive().max(10_000_000).optional(),
    // Single-campaign city (batch campaigns instead derive it per-location
    // from the connected GMB location — see createBatch below).
    city: z.string().trim().max(120).optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
    targetUrl: z.string().trim().max(500).optional().default(""),
    locationId: z.string().optional(),
    locations: z.array(locationItemSchema).min(1).max(25).optional(),
    // Optional pool of AI-drafted (or owner-written) review texts, single-
    // campaign mode only — see models/Campaign.js reviewDrafts.
    reviewDrafts: z.array(z.string().trim().min(1).max(1000)).max(200).optional(),
  })
  .strict()
  .refine((d) => Boolean(d.locations) || typeof d.budget === "number", {
    message: "Budget is required.",
    path: ["budget"],
  })
  .refine((d) => Boolean(d.locations) || d.city.length > 0, {
    message: "City is required.",
    path: ["city"],
  });

export async function GET() {
  const { user, response } = await apiRequirePermission("campaign:read");
  if (response) return response;

  await dbConnect();
  const campaigns = await Campaign.find({ user: user.id }).sort({ createdAt: -1 }).lean();
  return Response.json({ campaigns });
}

export async function POST(request) {
  const { user, response } = await apiRequirePermission("campaign:create");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { name, platform, budget, city, notes, targetUrl, locationId, locations, reviewDrafts } = parsed.data;

  // Live, admin-controlled rate — the single source of truth.
  const { reviewRate } = await getSettings();

  await dbConnect();

  if (locations) {
    return createBatch({ user, name, platform, notes, locations, reviewRate });
  }

  const trimmedCity = city.trim();

  if (budget < reviewRate) {
    return Response.json(
      { error: `Minimum budget is ₹${reviewRate} (one review).` },
      { status: 400 }
    );
  }

  // Atomic wallet debit: only succeeds if the balance is sufficient. This is the
  // single guard against overspend — no read-then-write race.
  const debited = await User.findOneAndUpdate(
    { _id: user.id, walletBalance: { $gte: budget } },
    { $inc: { walletBalance: -budget } },
    { returnDocument: "after" }
  ).select("walletBalance");

  if (!debited) {
    return Response.json(
      { error: "Insufficient wallet balance. Add funds and try again." },
      { status: 400 }
    );
  }

  await WalletTransaction.create({
    user: user.id,
    amount: -budget,
    type: "spend",
    note: `Campaign: ${name}`,
    balanceAfter: debited.walletBalance,
  });

  const campaign = await Campaign.create({
    user: user.id,
    name,
    platform,
    budget,
    ratePerReview: reviewRate,
    targetReviews: approxReviews(budget, reviewRate),
    notes,
    targetUrl,
    city: trimmedCity,
    location: locationId || null,
    status: "active",
    reviewDrafts: (reviewDrafts ?? []).map((text) => ({ text, assignedTo: null, assignedAt: null })),
  });

  return Response.json({ ok: true, campaign, balance: debited.walletBalance });
}

/**
 * Multi-location batch — Google only (only Google locations carry a real,
 * connected "write a review" link). One Campaign per selected location.
 */
async function createBatch({ user, name, platform, notes, locations, reviewRate }) {
  if (platform !== "google") {
    return Response.json(
      { error: "Multiple locations are only supported for Google campaigns." },
      { status: 400 }
    );
  }

  const ids = locations.map((l) => l.locationId);
  if (new Set(ids).size !== ids.length) {
    return Response.json({ error: "The same location was selected more than once." }, { status: 400 });
  }

  const locDocs = await GmbLocation.find({ _id: { $in: ids }, user: user.id });
  if (locDocs.length !== ids.length) {
    return Response.json({ error: "One or more locations weren't found." }, { status: 400 });
  }
  const locMap = new Map(locDocs.map((l) => [String(l._id), l]));

  for (const l of locations) {
    if (l.budget < reviewRate) {
      const label = locMap.get(l.locationId)?.title || "a location";
      return Response.json({ error: `Minimum budget for ${label} is ₹${reviewRate} (one review).` }, { status: 400 });
    }
  }

  const totalBudget = locations.reduce((sum, l) => sum + l.budget, 0);
  if (totalBudget > 10_000_000) {
    return Response.json({ error: "Total budget across locations is too large." }, { status: 400 });
  }

  // One atomic debit for the whole batch — same overspend guarantee as a
  // single campaign, just summed across every selected location up front.
  const debited = await User.findOneAndUpdate(
    { _id: user.id, walletBalance: { $gte: totalBudget } },
    { $inc: { walletBalance: -totalBudget } },
    { returnDocument: "after" }
  ).select("walletBalance");

  if (!debited) {
    return Response.json(
      { error: `Insufficient wallet balance. You need ₹${totalBudget} for ${locations.length} locations.` },
      { status: 400 }
    );
  }

  await WalletTransaction.create({
    user: user.id,
    amount: -totalBudget,
    type: "spend",
    note: `Campaign: ${name} (${locations.length} locations)`,
    balanceAfter: debited.walletBalance,
  });

  let created;
  try {
    created = await Campaign.insertMany(
      locations.map((l) => {
        const loc = locMap.get(l.locationId);
        // Address's leading segment reads as the city/area in Google's
        // format ("123 Main St, Koramangala, Bengaluru, …") — same parse
        // the create-campaign UI uses to label each location's city.
        const derivedCity = (loc.address || "").split(",").slice(1, 2)[0]?.trim() || loc.address || "";
        return {
          user: user.id,
          name: locations.length > 1 ? `${name} — ${loc.title || loc.locationName}` : name,
          platform: "google",
          budget: l.budget,
          ratePerReview: reviewRate,
          targetReviews: approxReviews(l.budget, reviewRate),
          notes,
          targetUrl: l.targetUrl || loc.reviewUrl || "",
          city: l.city?.trim() || derivedCity,
          location: loc._id,
          status: "active",
          reviewDrafts: (l.reviewDrafts ?? []).map((text) => ({ text, assignedTo: null, assignedAt: null })),
        };
      }),
      { ordered: true }
    );
  } catch {
    // Compensate — a DB failure here shouldn't strand money already debited
    // from the wallet with no campaigns to show for it.
    const refunded = await User.findOneAndUpdate(
      { _id: user.id },
      { $inc: { walletBalance: totalBudget } },
      { returnDocument: "after" }
    ).select("walletBalance");
    await WalletTransaction.create({
      user: user.id,
      amount: totalBudget,
      type: "refund",
      note: `Refund — campaign batch creation failed: ${name}`,
      balanceAfter: refunded?.walletBalance ?? totalBudget,
    });
    return Response.json({ error: "Couldn't create the campaigns — your wallet was refunded." }, { status: 500 });
  }

  return Response.json(
    { ok: true, campaigns: created, balance: debited.walletBalance },
    { status: 201 }
  );
}

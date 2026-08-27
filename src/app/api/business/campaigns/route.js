import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import Campaign from "../../../../models/Campaign";
import GmbLocation from "../../../../models/GmbLocation";
import PlayStoreApp from "../../../../models/PlayStoreApp";
import WalletTransaction from "../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { approxReviews, canonicalizeCity, deriveCityFromAddress } from "../../../../lib/campaigns";
import { getSettings } from "../../../../lib/settings";

/**
 * Create / list campaigns. Guarded by campaign:* (business owners), scoped to the
 * session user. Creating a campaign DEDUCTS its budget from the wallet atomically
 * (a conditional $inc that only applies if the balance is sufficient), records a
 * spend ledger entry, and computes targetReviews = floor(budget / ₹100).
 *
 * Two request shapes:
 *  - Single campaign (any platform): { name, platform, budget, notes, targetUrl, locationId }.
 *  - Multi-location batch, Google only: { name, platform: "google", notes, locations: [{locationId?, label?, budget, targetUrl?}, ...] }
 *    — one Campaign doc per selected location, each with its own budget slice.
 *    targetUrl defaults to that location's synced GmbLocation.reviewUrl but the
 *    owner can override it per location. An item can also skip locationId
 *    entirely and carry a pasted targetUrl (+ optional label) instead — an
 *    outlet that isn't on the connected Google account still gets a campaign.
 *    The whole batch is funded by a single
 *    atomic wallet debit (sum of the per-location budgets) so it can't
 *    partially succeed against the wallet.
 */
// Each drafted review is either a plain string (no keyword captured — owner
// typed it manually) or { text, keyword } pairing it with the local-search
// phrase it was written around (see lib/aiKeywords.js) — captured purely for
// display on the campaigns table, never read by assignment/claim logic.
const reviewDraftSchema = z.union([
  z.string().trim().min(1).max(1000),
  z.object({ text: z.string().trim().min(1).max(1000), keyword: z.string().trim().max(100).optional().default("") }),
]);

function normalizeDrafts(drafts) {
  return (drafts ?? []).map((d) => (typeof d === "string" ? { text: d, keyword: "" } : d));
}

const locationItemSchema = z.object({
  // Optional: a batch item is EITHER a connected GMB location or a review
  // link the owner pasted by hand (outlet not on the connected account, or
  // not synced yet). See the refine below — one of the two is required.
  locationId: z.string().min(1).optional(),
  // Manual items only — what to call the business behind the pasted link.
  // Snapshotted as the campaign's businessName and used to name the campaign
  // in a multi-item batch, the way a location's title is.
  label: z.string().trim().max(120).optional(),
  budget: z.number().int().positive().max(10_000_000),
  // Defaults to the location's own synced reviewUrl when omitted — this lets
  // the owner override it per-location (see createBatch below).
  targetUrl: z.string().trim().max(500).optional(),
  // Defaults to [the location's own address-derived city] when omitted —
  // same override pattern as targetUrl, but now a set: this location's
  // campaign can be open to reviewers in several cities, not just the one
  // the business itself sits in. Searched/added via Google Places, see
  // components/business/CityMultiSelect.jsx.
  cities: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  // Explicit "All India" tab pick (NewCampaignModal.jsx) — an empty `cities`
  // array alone is ambiguous with "owner didn't touch this field yet" (which
  // falls back to the location's own address-derived city, below), so this
  // is the actual signal that skips that fallback and leaves the campaign
  // open to every reviewer regardless of city.
  allIndia: z.boolean().optional(),
  // This location's slice of the AI-drafted (or owner-written) review pool —
  // see models/Campaign.js reviewDrafts.
  reviewDrafts: z.array(reviewDraftSchema).max(200).optional(),
  // This location's slice of the review-image pool — see models/Campaign.js
  // reviewImages. URLs only (already uploaded via
  // /api/business/campaigns/upload-image before submit).
  reviewImages: z.array(z.string().trim().url()).max(200).optional(),
  // This location's OWN drip pacing — see models/Campaign.js
  // pacingLimit/pacingWindowHours. Each location in a batch decides its own
  // gap independently (a busy flagship store might allow 2/day while a new
  // outlet paces 1 every 3 days).
  pacingLimit: z.number().int().min(1).max(1000).optional(),
  pacingWindowHours: z.number().int().min(1).max(24 * 90).optional(),
})
  .refine((l) => Boolean(l.pacingLimit) === Boolean(l.pacingWindowHours), {
    message: "Pacing needs both a review count and a time window.",
    path: ["pacingLimit"],
  })
  // Nothing auto-fills a manual item's URL, so an item with no locationId
  // must bring a real link — otherwise the campaign would go live pointing
  // reviewers at an empty targetUrl.
  .refine((l) => Boolean(l.locationId) || /^https?:\/\//i.test(l.targetUrl ?? ""), {
    message: "Add a review link (starting with http:// or https://) for each manual location.",
    path: ["targetUrl"],
  });

const createSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    platform: z.enum(["google", "trustpilot", "capterra", "amazon", "playstore"]).default("google"),
    budget: z.number().int().positive().max(10_000_000).optional(),
    // Single-campaign cities — lets one campaign be live to reviewers in
    // several cities at once (searched/added via Google Places, see
    // components/business/CityMultiSelect.jsx). Batch campaigns instead
    // derive a single city per-location from the connected GMB location —
    // see createBatch below, and models/Campaign.js's `city` vs `cities`.
    cities: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
    // See locationItemSchema's `allIndia` above — same "explicit, not just
    // an empty array" signal, single-campaign mode's version of it.
    allIndia: z.boolean().optional(),
    notes: z.string().trim().max(500).optional().default(""),
    targetUrl: z.string().trim().max(500).optional().default(""),
    locationId: z.string().optional(),
    // Play Store equivalent of locationId — a tracked PlayStoreApp (see
    // models/PlayStoreApp.js). Single-campaign mode only; there's no batch
    // (multi-app) mode for Play Store the way there is for Google locations.
    playStoreAppId: z.string().optional(),
    locations: z.array(locationItemSchema).min(1).max(25).optional(),
    // Optional pool of AI-drafted (or owner-written) review texts, single-
    // campaign mode only — see models/Campaign.js reviewDrafts.
    reviewDrafts: z.array(reviewDraftSchema).max(200).optional(),
    // Optional pool of images for reviewers to download/attach, single-
    // campaign mode only — see models/Campaign.js reviewImages.
    reviewImages: z.array(z.string().trim().url()).max(200).optional(),
    // Optional "drip" pacing, single-campaign mode only — see
    // models/Campaign.js pacingLimit/pacingWindowHours. Multi-location batch
    // mode sets this per-location instead (locationItemSchema below), since
    // different locations often want a different pace.
    pacingLimit: z.number().int().min(1).max(1000).optional(),
    pacingWindowHours: z.number().int().min(1).max(24 * 90).optional(),
  })
  .strict()
  .refine((d) => Boolean(d.locations) || typeof d.budget === "number", {
    message: "Budget is required.",
    path: ["budget"],
  })
  .refine((d) => Boolean(d.locations) || d.cities.length > 0 || d.allIndia === true, {
    message: "Add at least one city, or choose All India.",
    path: ["cities"],
  })
  .refine((d) => Boolean(d.pacingLimit) === Boolean(d.pacingWindowHours), {
    message: "Pacing needs both a review count and a time window.",
    path: ["pacingLimit"],
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
  const {
    name,
    platform,
    budget,
    cities,
    notes,
    targetUrl,
    locationId,
    playStoreAppId,
    locations,
    reviewDrafts,
    reviewImages,
    pacingLimit,
    pacingWindowHours,
  } = parsed.data;

  // Live, admin-controlled rate — the single source of truth.
  const { reviewRate } = await getSettings();

  await dbConnect();

  if (locations) {
    return createBatch({ user, name, platform, notes, locations, reviewRate });
  }

  const trimmedCities = [...new Set(cities.map((c) => canonicalizeCity(c)).filter(Boolean))];

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

  // Snapshot the business name/category off the linked GMB location, or the
  // app label off the linked Play Store app, if either is set — see
  // models/Campaign.js's businessName/businessCategory for why this is
  // copied rather than read live through `location`/`playStoreApp` later.
  const linkedLocation = locationId
    ? await GmbLocation.findOne({ _id: locationId, user: user.id }).select("title category")
    : null;
  const linkedPsApp =
    !linkedLocation && platform === "playstore" && playStoreAppId
      ? await PlayStoreApp.findOne({ _id: playStoreAppId, user: user.id }).select("label packageName")
      : null;

  const campaign = await Campaign.create({
    user: user.id,
    name,
    platform,
    budget,
    ratePerReview: reviewRate,
    targetReviews: approxReviews(budget, reviewRate),
    notes,
    targetUrl,
    cities: trimmedCities,
    location: linkedLocation ? locationId : null,
    playStoreApp: linkedPsApp ? playStoreAppId : null,
    businessName: linkedLocation?.title || linkedPsApp?.label || linkedPsApp?.packageName || "",
    businessCategory: linkedLocation?.category || "",
    status: "active",
    reviewDrafts: normalizeDrafts(reviewDrafts).map((d) => ({ ...d, assignedTo: null, assignedAt: null })),
    reviewImages: (reviewImages ?? []).map((url) => ({ url, assignedTo: null, assignedAt: null })),
    pacingLimit: pacingLimit ?? null,
    pacingWindowHours: pacingWindowHours ?? null,
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

  // Manual items carry no locationId — only the connected ones are deduped
  // and looked up. Two manual rows pointing at the same pasted link are the
  // owner's call (different review counts, different pacing), not an error.
  const ids = locations.map((l) => l.locationId).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    return Response.json({ error: "The same location was selected more than once." }, { status: 400 });
  }

  const locDocs = ids.length > 0 ? await GmbLocation.find({ _id: { $in: ids }, user: user.id }) : [];
  if (locDocs.length !== ids.length) {
    return Response.json({ error: "One or more locations weren't found." }, { status: 400 });
  }
  const locMap = new Map(locDocs.map((l) => [String(l._id), l]));

  for (const l of locations) {
    if (l.budget < reviewRate) {
      const label = (l.locationId ? locMap.get(l.locationId)?.title : l.label) || "a location";
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
      locations.map((l, i) => {
        const loc = l.locationId ? locMap.get(l.locationId) : null;
        // See lib/campaigns.js#deriveCityFromAddress — same parse the
        // create-campaign UI uses to label each location's city. A manual
        // item has no address to parse, so it has no derived city either —
        // it falls back to whatever cities the owner picked (or All India).
        const derivedCity = loc ? deriveCityFromAddress(loc.address) : "";
        // What this item is called: the connected location's own title,
        // else the label typed next to the pasted link, else its position —
        // a batch of unnamed links still reads as distinct campaigns.
        const itemLabel = loc ? loc.title || loc.locationName : l.label || `Location ${i + 1}`;
        return {
          user: user.id,
          name: locations.length > 1 ? `${name} — ${itemLabel}` : name,
          platform: "google",
          budget: l.budget,
          ratePerReview: reviewRate,
          targetReviews: approxReviews(l.budget, reviewRate),
          notes,
          targetUrl: l.targetUrl || loc?.reviewUrl || "",
          cities: l.allIndia
            ? []
            : l.cities?.length > 0
              ? [...new Set(l.cities.map((c) => canonicalizeCity(c)).filter(Boolean))]
              : [canonicalizeCity(derivedCity)].filter(Boolean),
          location: loc?._id ?? null,
          businessName: loc?.title || l.label || "",
          businessCategory: loc?.category || "",
          status: "active",
          reviewDrafts: normalizeDrafts(l.reviewDrafts).map((d) => ({ ...d, assignedTo: null, assignedAt: null })),
          reviewImages: (l.reviewImages ?? []).map((url) => ({ url, assignedTo: null, assignedAt: null })),
          pacingLimit: l.pacingLimit ?? null,
          pacingWindowHours: l.pacingWindowHours ?? null,
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

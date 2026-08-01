import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import Campaign from "../../../../models/Campaign";
import WalletTransaction from "../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { approxReviews } from "../../../../lib/campaigns";
import { getSettings } from "../../../../lib/settings";

/**
 * Create / list campaigns. Guarded by campaign:* (business owners), scoped to the
 * session user. Creating a campaign DEDUCTS its budget from the wallet atomically
 * (a conditional $inc that only applies if the balance is sufficient), records a
 * spend ledger entry, and computes targetReviews = floor(budget / ₹100).
 */
const createSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    platform: z.enum(["google", "trustpilot", "capterra", "amazon", "playstore"]).default("google"),
    budget: z.number().int().positive().max(10_000_000),
    notes: z.string().trim().max(500).optional().default(""),
    targetUrl: z.string().trim().max(500).optional().default(""),
    locationId: z.string().optional(),
  })
  .strict();

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
  const { name, platform, budget, notes, targetUrl, locationId } = parsed.data;

  // Live, admin-controlled rate — the single source of truth.
  const { reviewRate } = await getSettings();

  if (budget < reviewRate) {
    return Response.json(
      { error: `Minimum budget is ₹${reviewRate} (one review).` },
      { status: 400 }
    );
  }

  await dbConnect();

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
    location: locationId || null,
    status: "active",
  });

  return Response.json({ ok: true, campaign, balance: debited.walletBalance });
}

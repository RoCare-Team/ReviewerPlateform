import mongoose from "mongoose";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import Campaign from "../../../../models/Campaign";
import Submission from "../../../../models/Submission";
import GmbConnection from "../../../../models/GmbConnection";
import GmbLocation from "../../../../models/GmbLocation";
import GmbReview from "../../../../models/GmbReview";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * The business dashboard counters, as one call.
 *
 * These are the same numbers src/app/(app)/business/page.jsx computes inline
 * in its server component — pulled out into a REST endpoint so the mobile app
 * can read them too. Every query is scoped to `user: user.id` from the
 * session.
 *
 * Counted with countDocuments/aggregate rather than fetching documents: the
 * dashboard only ever shows the totals, and a business with hundreds of
 * synced reviews shouldn't pay to load them all just to show one number.
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("campaign:read");
  if (response) return response;

  await dbConnect();

  // aggregate() skips Mongoose's schema casting, so the id must be a real
  // ObjectId here — a plain string silently matches nothing.
  const ownerId = new mongoose.Types.ObjectId(String(user.id));

  const [
    doc,
    activeConnections,
    locationCount,
    reviewCount,
    activeCampaigns,
    collectedAgg,
    pendingSubmissions,
    ratingAgg,
  ] = await Promise.all([
    User.findById(user.id).select("walletBalance").lean(),
    GmbConnection.countDocuments({ user: user.id, status: "active" }),
    GmbLocation.countDocuments({ user: user.id }),
    GmbReview.countDocuments({ user: user.id }),
    Campaign.countDocuments({ user: user.id, status: "active" }),
    Campaign.aggregate([
      { $match: { user: ownerId } },
      { $group: { _id: null, total: { $sum: "$collected" } } },
    ]),
    Submission.countDocuments({ business: user.id, status: "pending" }),
    GmbReview.aggregate([
      { $match: { user: ownerId, starRating: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$starRating" } } },
    ]),
  ]);

  return Response.json({
    walletBalance: doc?.walletBalance ?? 0,
    activeConnections,
    locationCount,
    reviewCount,
    activeCampaigns,
    totalCollected: collectedAgg[0]?.total ?? 0,
    pendingSubmissions,
    averageRating: ratingAgg[0]?.avg ?? 0,
  });
}

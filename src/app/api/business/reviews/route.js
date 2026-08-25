import dbConnect from "../../../../lib/db";
import GmbReview from "../../../../models/GmbReview";
import GmbLocation from "../../../../models/GmbLocation";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * This owner's synced Google reviews, newest first — what
 * src/app/(app)/business/reviews/page.jsx renders, as REST.
 *
 * Deliberately does NOT auto-sync the way that page does. The website syncs on
 * page load because a web visit is rare and deliberate; a mobile list can be
 * pulled to refresh several times a minute, and each sync is a round-trip to
 * Google's API against a rate limit. The app triggers a sync explicitly
 * through the existing POST /api/business/gmb/sync instead.
 */
export async function GET(request) {
  const { user, response } = await apiRequirePermission("review:reply");
  if (response) return response;

  await dbConnect();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 500);

  const reviews = await GmbReview.find({ user: user.id })
    .sort({ createTime: -1 })
    .limit(limit)
    .lean();

  const locations = await GmbLocation.find({ user: user.id })
    .select("title locationName")
    .lean();
  const titleById = new Map(
    locations.map((l) => [String(l._id), l.title || l.locationName])
  );

  return Response.json({
    reviews: reviews.map((r) => ({
      id: String(r._id),
      reviewerName: r.reviewerName || "Anonymous",
      reviewerPhoto: r.reviewerPhoto ?? "",
      starRating: r.starRating ?? 0,
      comment: r.comment ?? "",
      reply: r.reply ?? "",
      autoReplied: r.autoReplied ?? false,
      locationTitle: titleById.get(String(r.location)) ?? "",
      createTime: r.createTime,
    })),
  });
}

import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import GmbConnection from "../../../../../models/GmbConnection";
import GmbLocation from "../../../../../models/GmbLocation";
import GmbReview from "../../../../../models/GmbReview";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { getValidAccessToken, listReviews, normalizeReview } from "../../../../../lib/gmb";

/**
 * Fetch reviews for every location of a connection and upsert them. Guarded by
 * connection:google:manage and scoped to the session user — a caller can only
 * sync their own connections. Body: { connectionId }.
 */
const schema = z.object({ connectionId: z.string().min(1) }).strict();

export async function POST(request) {
  const { user, response } = await apiRequirePermission("connection:google:manage");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  await dbConnect();

  const conn = await GmbConnection.findOne({ _id: parsed.data.connectionId, user: user.id }).select(
    "+accessToken +refreshToken"
  );
  if (!conn) return Response.json({ error: "Connection not found" }, { status: 404 });

  let accessToken;
  try {
    accessToken = await getValidAccessToken(conn);
  } catch (e) {
    await GmbConnection.updateOne({ _id: conn._id }, { $set: { status: "error", lastError: String(e.message).slice(0, 300) } });
    return Response.json({ error: "Reconnect required — token refresh failed." }, { status: 401 });
  }

  const locations = await GmbLocation.find({ connection: conn._id, user: user.id });
  let totalSynced = 0;
  const errors = [];

  for (const loc of locations) {
    try {
      const data = await listReviews(accessToken, loc.accountName, loc.locationName);
      const reviews = data.reviews ?? [];
      for (const raw of reviews) {
        const r = normalizeReview(raw);
        if (!r.reviewId) continue;
        await GmbReview.findOneAndUpdate(
          { location: loc._id, reviewId: r.reviewId },
          { $set: { ...r, user: user.id, connection: conn._id, location: loc._id } },
          { upsert: true, setDefaultsOnInsert: true }
        );
        totalSynced += 1;
      }
      await GmbLocation.updateOne(
        { _id: loc._id },
        {
          $set: {
            reviewCount: data.totalReviewCount ?? reviews.length,
            averageRating: data.averageRating ?? 0,
            lastSyncedAt: new Date(),
          },
        }
      );
    } catch (e) {
      errors.push(`${loc.title || loc.locationName}: ${e.message}`);
    }
  }

  await GmbConnection.updateOne(
    { _id: conn._id },
    { $set: { lastError: errors.join(" | ").slice(0, 300) } }
  );

  return Response.json({ ok: true, synced: totalSynced, locations: locations.length, errors });
}

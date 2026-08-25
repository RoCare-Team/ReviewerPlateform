import dbConnect from "../../../../lib/db";
import GmbConnection from "../../../../models/GmbConnection";
import GmbLocation from "../../../../models/GmbLocation";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * This owner's Google Business Profile connections, each with its locations
 * nested — the same data src/app/(app)/business/connections/page.jsx reads
 * inline, exposed as REST for the mobile app.
 *
 * NOTE the `.select()`: accessToken and refreshToken are `select: false` on
 * the model, so they're excluded by default — but this route lists them out
 * explicitly anyway rather than relying on that, because a token must never
 * leave the server even by accident. `lastError` IS returned: it's what tells
 * the owner their connection needs reconnecting.
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("connection:google:manage");
  if (response) return response;

  await dbConnect();

  const connections = await GmbConnection.find({ user: user.id })
    .select("googleEmail status lastError autoReplyEnabled createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const locations = await GmbLocation.find({
    connection: { $in: connections.map((c) => c._id) },
    user: user.id,
  }).lean();

  const byConnection = new Map();
  for (const loc of locations) {
    const key = String(loc.connection);
    if (!byConnection.has(key)) byConnection.set(key, []);
    byConnection.get(key).push({
      id: String(loc._id),
      title: loc.title || loc.locationName,
      locationName: loc.locationName,
      address: loc.address ?? "",
      category: loc.category ?? "",
      reviewUrl: loc.reviewUrl ?? "",
      reviewCount: loc.reviewCount ?? 0,
      averageRating: loc.averageRating ?? 0,
      lastSyncedAt: loc.lastSyncedAt,
    });
  }

  return Response.json({
    connections: connections.map((c) => ({
      id: String(c._id),
      googleEmail: c.googleEmail,
      status: c.status,
      lastError: c.lastError ?? "",
      autoReplyEnabled: c.autoReplyEnabled ?? false,
      createdAt: c.createdAt,
      locations: byConnection.get(String(c._id)) ?? [],
    })),
  });
}

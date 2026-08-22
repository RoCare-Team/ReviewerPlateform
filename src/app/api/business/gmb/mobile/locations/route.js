import dbConnect from "../../../../../../lib/db";
import GmbConnection from "../../../../../../models/GmbConnection";
import GmbLocation from "../../../../../../models/GmbLocation";
import { apiRequirePermission } from "../../../../../../lib/auth/guards";

/**
 * Mobile-app read: every GMB connection + its locations for the current
 * business owner, as plain JSON (server components read these straight from
 * the DB for the web UI — a phone app has no server component, so it needs
 * an actual endpoint). Read-only; connecting happens at
 * api/business/gmb/mobile/connect, disconnecting at api/business/gmb/{id}.
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("connection:google:manage");
  if (response) return response;

  await dbConnect();

  const connections = await GmbConnection.find({ user: user.id })
    .select("googleEmail status lastError createdAt")
    .lean();

  const locations = await GmbLocation.find({ user: user.id })
    .select("connection title storeCode address reviewUrl category reviewCount averageRating lastSyncedAt")
    .lean();

  const locationsByConnection = new Map();
  for (const loc of locations) {
    const key = String(loc.connection);
    if (!locationsByConnection.has(key)) locationsByConnection.set(key, []);
    locationsByConnection.get(key).push({
      id: String(loc._id),
      title: loc.title,
      storeCode: loc.storeCode,
      address: loc.address,
      reviewUrl: loc.reviewUrl,
      category: loc.category,
      reviewCount: loc.reviewCount ?? 0,
      averageRating: loc.averageRating ?? 0,
      lastSyncedAt: loc.lastSyncedAt ?? null,
    });
  }

  return Response.json({
    ok: true,
    connections: connections.map((c) => ({
      id: String(c._id),
      googleEmail: c.googleEmail,
      status: c.status,
      lastError: c.lastError || "",
      createdAt: c.createdAt,
      locations: locationsByConnection.get(String(c._id)) ?? [],
    })),
  });
}

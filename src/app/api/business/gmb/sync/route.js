import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import GmbConnection from "../../../../../models/GmbConnection";
import GmbLocation from "../../../../../models/GmbLocation";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { syncConnectionReviews } from "../../../../../lib/gmb";

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

  const locations = await GmbLocation.find({ connection: conn._id, user: user.id });
  const { totalSynced, errors } = await syncConnectionReviews(conn, locations);

  if (errors.length && errors[0].startsWith("Token refresh failed")) {
    await GmbConnection.updateOne({ _id: conn._id }, { $set: { status: "error", lastError: errors[0].slice(0, 300) } });
    return Response.json({ error: "Reconnect required — token refresh failed." }, { status: 401 });
  }

  await GmbConnection.updateOne(
    { _id: conn._id },
    { $set: { lastError: errors.join(" | ").slice(0, 300) } }
  );

  return Response.json({ ok: true, synced: totalSynced, locations: locations.length, errors });
}

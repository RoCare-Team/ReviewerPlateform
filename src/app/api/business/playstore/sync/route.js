import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import PlayStoreConnection from "../../../../../models/PlayStoreConnection";
import PlayStoreApp from "../../../../../models/PlayStoreApp";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { syncConnectionReviews } from "../../../../../lib/playstore";

/**
 * Fetch reviews for every tracked app of a connection and upsert them.
 * Guarded by connection:playstore:manage and scoped to the session user.
 * Body: { connectionId }.
 */
const schema = z.object({ connectionId: z.string().min(1) }).strict();

export async function POST(request) {
  const { user, response } = await apiRequirePermission("connection:playstore:manage");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  await dbConnect();

  const conn = await PlayStoreConnection.findOne({ _id: parsed.data.connectionId, user: user.id }).select(
    "+accessToken +refreshToken"
  );
  if (!conn) return Response.json({ error: "Connection not found" }, { status: 404 });

  const apps = await PlayStoreApp.find({ connection: conn._id, user: user.id });
  if (!apps.length) return Response.json({ error: "Add a package name first." }, { status: 400 });

  const { totalSynced, errors } = await syncConnectionReviews(conn, apps);

  if (errors.length && errors[0].startsWith("Token refresh failed")) {
    await PlayStoreConnection.updateOne({ _id: conn._id }, { $set: { status: "error", lastError: errors[0].slice(0, 300) } });
    return Response.json({ error: "Reconnect required — token refresh failed." }, { status: 401 });
  }

  await PlayStoreConnection.updateOne(
    { _id: conn._id },
    { $set: { lastError: errors.join(" | ").slice(0, 300) } }
  );

  return Response.json({ ok: true, synced: totalSynced, apps: apps.length, errors });
}

import dbConnect from "../../../../../lib/db";
import PlayStoreConnection from "../../../../../models/PlayStoreConnection";
import PlayStoreApp from "../../../../../models/PlayStoreApp";
import PlayStoreReview from "../../../../../models/PlayStoreReview";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { revokeToken } from "../../../../../lib/playstore";

/**
 * Disconnect a Play Store account: revoke the token with Google and delete
 * the connection plus its tracked apps and reviews. Scoped to the session user.
 */
export async function DELETE(_request, { params }) {
  const { user, response } = await apiRequirePermission("connection:playstore:manage");
  if (response) return response;

  const { id } = await params;

  await dbConnect();
  const conn = await PlayStoreConnection.findOne({ _id: id, user: user.id }).select("+refreshToken +accessToken");
  if (!conn) return Response.json({ error: "Connection not found" }, { status: 404 });

  // Best-effort revoke at Google, then remove our records.
  if (conn.refreshToken) await revokeToken(conn.refreshToken);
  else if (conn.accessToken) await revokeToken(conn.accessToken);

  const apps = await PlayStoreApp.find({ connection: conn._id }).select("_id");
  await PlayStoreReview.deleteMany({ app: { $in: apps.map((a) => a._id) } });
  await PlayStoreApp.deleteMany({ connection: conn._id });
  await PlayStoreConnection.deleteOne({ _id: conn._id });

  return Response.json({ ok: true });
}

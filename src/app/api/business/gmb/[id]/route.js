import dbConnect from "../../../../../lib/db";
import GmbConnection from "../../../../../models/GmbConnection";
import GmbLocation from "../../../../../models/GmbLocation";
import GmbReview from "../../../../../models/GmbReview";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { revokeToken } from "../../../../../lib/gmb";

/**
 * Disconnect a GMB account: revoke the token with Google and delete the
 * connection plus its locations and reviews. Scoped to the session user.
 */
export async function DELETE(_request, { params }) {
  const { user, response } = await apiRequirePermission("connection:google:manage");
  if (response) return response;

  const { id } = await params;

  await dbConnect();
  const conn = await GmbConnection.findOne({ _id: id, user: user.id }).select("+refreshToken +accessToken");
  if (!conn) return Response.json({ error: "Connection not found" }, { status: 404 });

  // Best-effort revoke at Google, then remove our records.
  if (conn.refreshToken) await revokeToken(conn.refreshToken);
  else if (conn.accessToken) await revokeToken(conn.accessToken);

  await GmbReview.deleteMany({ connection: conn._id });
  await GmbLocation.deleteMany({ connection: conn._id });
  await GmbConnection.deleteOne({ _id: conn._id });

  return Response.json({ ok: true });
}

import dbConnect from "../../../../../../lib/db";
import PlayStoreApp from "../../../../../../models/PlayStoreApp";
import PlayStoreReview from "../../../../../../models/PlayStoreReview";
import { apiRequirePermission } from "../../../../../../lib/auth/guards";

/** Stop tracking an app: delete it and its synced reviews. Scoped to the session user. */
export async function DELETE(_request, { params }) {
  const { user, response } = await apiRequirePermission("connection:playstore:manage");
  if (response) return response;

  const { id } = await params;

  await dbConnect();
  const app = await PlayStoreApp.findOne({ _id: id, user: user.id });
  if (!app) return Response.json({ error: "App not found" }, { status: 404 });

  await PlayStoreReview.deleteMany({ app: app._id });
  await PlayStoreApp.deleteOne({ _id: app._id });

  return Response.json({ ok: true });
}

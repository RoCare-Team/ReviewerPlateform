import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import PlayStoreConnection from "../../../../../models/PlayStoreConnection";
import PlayStoreApp from "../../../../../models/PlayStoreApp";
import { apiRequirePermission } from "../../../../../lib/auth/guards";

/**
 * Add a package name to track under a connection. There's no "list my apps"
 * androidpublisher endpoint, so the user types the package name in — Google
 * itself rejects the first sync if the connected account has no Play Console
 * access to it (see lib/playstore.js syncConnectionReviews).
 * Body: { connectionId, packageName, label? }.
 */
const schema = z.object({
  connectionId: z.string().min(1),
  packageName: z
    .string()
    .trim()
    .min(3)
    .max(150)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/, "Not a valid Android package name (e.g. com.example.app)"),
  label: z.string().trim().max(120).optional(),
});

export async function POST(request) {
  const { user, response } = await apiRequirePermission("connection:playstore:manage");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { connectionId, packageName, label } = parsed.data;

  await dbConnect();

  const conn = await PlayStoreConnection.findOne({ _id: connectionId, user: user.id });
  if (!conn) return Response.json({ error: "Connection not found" }, { status: 404 });

  try {
    const app = await PlayStoreApp.findOneAndUpdate(
      { connection: conn._id, packageName },
      {
        $set: { user: user.id, connection: conn._id, googleEmail: conn.googleEmail, packageName },
        $setOnInsert: { label: label || packageName },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return Response.json({ ok: true, app: { id: String(app._id), packageName: app.packageName, label: app.label } });
  } catch (e) {
    // Duplicate key race (unique index) — treat as already-added, not an error.
    if (e.code === 11000) return Response.json({ error: "This app is already tracked." }, { status: 409 });
    throw e;
  }
}

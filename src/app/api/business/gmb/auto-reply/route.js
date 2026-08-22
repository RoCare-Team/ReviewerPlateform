import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import GmbConnection from "../../../../../models/GmbConnection";
import { apiRequirePermission } from "../../../../../lib/auth/guards";

/**
 * Turns AI auto-reply on/off for all of the session user's active GMB
 * connections. Actual reply generation/posting happens in the
 * gmb-auto-reply cron (src/app/api/cron/gmb-auto-reply) — this just flips
 * the flag it reads. Body: { enabled: boolean }
 */
const schema = z.object({ enabled: z.boolean() });

export async function POST(request) {
  const { user, response } = await apiRequirePermission("review:reply");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await dbConnect();

  await GmbConnection.updateMany(
    { user: user.id, status: "active" },
    { $set: { autoReplyEnabled: parsed.data.enabled } }
  );

  return Response.json({ ok: true, enabled: parsed.data.enabled });
}

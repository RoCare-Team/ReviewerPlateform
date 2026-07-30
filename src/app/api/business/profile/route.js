import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * Business-owner self-service profile update. Guarded by profile:update (see
 * data/roles.json). The id comes from the session, never the body — a user can
 * only edit their own record. Role/email/status are not editable here.
 */
const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    phone: z.string().trim().max(20).optional().default(""),
    bio: z.string().trim().max(280).optional().default(""),
  })
  .strict();

export async function PATCH(request) {
  const { user, response } = await apiRequirePermission("profile:update");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();
  const updated = await User.findByIdAndUpdate(
    user.id,
    { $set: parsed.data },
    { new: true, runValidators: true }
  ).select("name phone bio email");

  if (!updated) return Response.json({ error: "Account not found" }, { status: 404 });

  return Response.json({
    ok: true,
    profile: {
      name: updated.name ?? "",
      phone: updated.phone ?? "",
      bio: updated.bio ?? "",
      email: updated.email,
    },
  });
}

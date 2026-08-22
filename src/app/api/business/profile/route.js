import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * Business-owner self-service profile update. Guarded by profile:update (see
 * data/roles.json). The id comes from the session, never the body — a user can
 * only edit their own record. Role/status are not editable here.
 *
 * `phone` is accepted in the body (so the existing client form doesn't 400)
 * but never applied — it's this role's LOGIN identity now (phone+OTP, see
 * lib/auth/phoneAuth.js), so changing it here would swap someone's login
 * number with no re-verification. That needs its own re-verify-by-OTP flow,
 * which doesn't exist yet.
 */
const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    phone: z.string().trim().max(20).optional(),
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
    { $set: { name: parsed.data.name, bio: parsed.data.bio } },
    { returnDocument: "after", runValidators: true }
  ).select("name phone bio");

  if (!updated) return Response.json({ error: "Account not found" }, { status: 404 });

  return Response.json({
    ok: true,
    profile: {
      name: updated.name ?? "",
      phone: updated.phone ?? "",
      bio: updated.bio ?? "",
    },
  });
}

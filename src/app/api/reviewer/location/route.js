import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";

/**
 * Updates a reviewer's declared city — reviewer-only, a business_owner's
 * location is never captured or stored. Set mandatorily at signup (see
 * PhoneOtpForm.jsx + api/auth/signup/reviewer/complete); this is only for
 * changing it later (moved cities), from the State & City picker on
 * /reviewer/profile (components/reviewer/LocationCard.jsx).
 *
 * Deliberately NOT browser geolocation — no navigator.geolocation, no
 * lat/lng, no reverse-geocoding API call. The reviewer picks their city
 * from the same India state→city dataset the campaign-creation form uses
 * (lib/data/indiaStatesCities.js), so it can never drift from what
 * Campaign.city actually gets compared against.
 *
 * Body: { city }.
 */
const schema = z
  .object({
    city: z.string().trim().min(1, "City is required").max(120),
  })
  .strict();

export async function POST(request) {
  const { user, response } = await apiRequirePermission("profile:update");
  if (response) return response;

  // profile:update is shared with business_owner too — this endpoint is
  // reviewer-only.
  if (user.role !== ROLES.REVIEWER) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid city" }, { status: 400 });
  }

  await dbConnect();
  await User.updateOne(
    { _id: user.id },
    { $set: { location: { city: parsed.data.city, updatedAt: new Date() } } }
  );

  return Response.json({ ok: true, city: parsed.data.city });
}

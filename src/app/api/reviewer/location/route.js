import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import { reverseGeocode } from "../../../../lib/googleMaps";

/**
 * Saves a reviewer's current location, captured client-side via
 * navigator.geolocation right after they land on their dashboard
 * (src/components/reviewer/LocationCapture.jsx). Reviewer-only — a
 * business_owner's location is never captured or stored.
 *
 * Body: { lat, lng }. The address is filled in server-side via reverse
 * geocoding (lib/googleMaps.js) so the Google Maps API key never reaches
 * the client.
 */
const schema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
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
  if (!parsed.success) return Response.json({ error: "Invalid coordinates" }, { status: 400 });

  const { lat, lng } = parsed.data;
  const { address, city } = await reverseGeocode(lat, lng);

  await dbConnect();
  await User.updateOne(
    { _id: user.id },
    { $set: { location: { lat, lng, address, city, updatedAt: new Date() } } }
  );

  return Response.json({ ok: true, address, city });
}

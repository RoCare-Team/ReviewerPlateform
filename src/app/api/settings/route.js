import { getSettings } from "../../../lib/settings";

/**
 * Public pricing — the mobile app reads this once at startup so it never
 * hardcodes a reward, a rate or a withdrawal floor.
 *
 * Deliberately unauthenticated: every number here is already visible on the
 * public pricing page, and the app needs them before anyone has signed in.
 */
export async function GET() {
  const settings = await getSettings();
  return Response.json(settings, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}

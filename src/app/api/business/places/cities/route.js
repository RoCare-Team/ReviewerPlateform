import { apiRequireAuth } from "../../../../../lib/auth/guards";
import { searchCities, isConfigured } from "../../../../../lib/googlePlaces";
import { rateLimit, clientIp } from "../../../../../lib/rate-limit";

/**
 * City search for the campaign city picker (components/business/CityMultiSelect.jsx).
 * GET ?q=<query> → { cities: [{ placeId, description, city }] }.
 *
 * Any authenticated, active account can hit this (not campaign:create-gated)
 * — it returns nothing sensitive, just Google's own public autocomplete data,
 * and gating it any tighter would only complicate a component that might be
 * reused elsewhere later. Rate-limited per-IP since it's a live proxy to a
 * billed Google API.
 */
export async function GET(request) {
  const { response } = await apiRequireAuth();
  if (response) return response;

  if (!isConfigured()) {
    return Response.json({ cities: [], error: "City search isn't configured on the server." }, { status: 200 });
  }

  const byIp = rateLimit(`places-cities:${clientIp(request)}`, { limit: 60, windowMs: 60 * 1000 });
  if (!byIp.ok) {
    return Response.json({ error: "Too many requests. Slow down a little." }, { status: 429 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return Response.json({ cities: [] });
  }

  const cities = await searchCities(q);
  return Response.json({ cities });
}

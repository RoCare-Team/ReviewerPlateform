/**
 * Google Places Autocomplete, restricted to Indian cities — backs the
 * campaign city picker (components/business/CityMultiSelect.jsx). Server-
 * side only: GOOGLE_MAPS_API_KEY has no NEXT_PUBLIC_ prefix on purpose, so it
 * never ships to the browser. The client hits api/business/places/cities
 * instead, which calls this.
 *
 * Uses the classic (non-"New") Place Autocomplete endpoint deliberately —
 * `types=(cities)` is exactly the city-only filter this needs, it's a plain
 * GET, and it's been stable for years, unlike the newer Places API (New)
 * which needs a separate opt-in enablement on the Google Cloud project.
 */
const AUTOCOMPLETE_ENDPOINT = "https://maps.googleapis.com/maps/api/place/autocomplete/json";

export function isConfigured() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

/**
 * Returns up to 5 city suggestions for `query`, or [] on any failure
 * (missing key, network error, zero results) — a broken suggestion API
 * should degrade to "type the city name yourself", never break the form.
 */
export async function searchCities(query) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !query?.trim()) return [];

  const params = new URLSearchParams({
    input: query.trim(),
    types: "(cities)",
    components: "country:in",
    key,
  });

  try {
    const res = await fetch(`${AUTOCOMPLETE_ENDPOINT}?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== "OK" || !Array.isArray(data.predictions)) return [];

    return data.predictions.slice(0, 5).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      // The short city name — what gets STORED and matched against a
      // reviewer's own declared city (User.location.city, a plain city
      // name, no state/country suffix). Falls back to the first comma
      // segment of the full description if Google's structured field is
      // ever missing.
      city: p.structured_formatting?.main_text || p.description.split(",")[0].trim(),
    }));
  } catch {
    return [];
  }
}

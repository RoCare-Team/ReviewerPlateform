/**
 * Google Maps Geocoding API — server-only. The browser only ever calls its
 * own `navigator.geolocation` for lat/lng (free, no API key); turning that
 * into a human-readable address/city happens here, server-side, so
 * GOOGLE_MAPS_API_KEY never reaches the client bundle.
 */
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export function googleMapsConfigured() {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

/** Pull the city out of a geocoding result's address_components. Google has
 *  no single universal "city" type — `locality` is the normal case, but
 *  smaller towns / some countries only get `postal_town` or
 *  `administrative_area_level_2`, so fall through in that order. */
function extractCity(addressComponents = []) {
  const TYPE_PRIORITY = ["locality", "postal_town", "administrative_area_level_2"];
  for (const type of TYPE_PRIORITY) {
    const match = addressComponents.find((c) => c.types.includes(type));
    if (match) return match.long_name;
  }
  return "";
}

/**
 * Reverse-geocode { lat, lng } into { address, city }.
 * Returns { address: "", city: "" } if unconfigured, not found, or the API
 * call fails — reverse geocoding is a nice-to-have on top of the raw
 * coordinates, never a hard requirement for saving a reviewer's location.
 */
export async function reverseGeocode(lat, lng) {
  if (!googleMapsConfigured()) return { address: "", city: "" };

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) {
      if (data.status !== "ZERO_RESULTS") {
        console.error("[googleMaps] reverseGeocode failed", data.status, data.error_message);
      }
      return { address: "", city: "" };
    }
    const top = data.results[0];
    return { address: top.formatted_address ?? "", city: extractCity(top.address_components) };
  } catch (e) {
    console.error("[googleMaps] reverseGeocode request failed", e.message);
    return { address: "", city: "" };
  }
}

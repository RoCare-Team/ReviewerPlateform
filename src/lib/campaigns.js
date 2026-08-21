/**
 * Campaign economics. Single source of truth for the review rate so the form
 * preview, the server validation and the stored campaign can't drift.
 */
// Fallback default only. The live rate is admin-controlled via lib/settings.js
// (AppSettings.reviewRate) — always pass that rate in rather than relying on this.
export const RATE_PER_REVIEW = 100; // ₹ per verified review (default)

/** Approx reviews a budget buys at the given rate (defaults to the fallback). */
export function approxReviews(budget, rate = RATE_PER_REVIEW) {
  const b = Number(budget);
  const r = Number(rate) || RATE_PER_REVIEW;
  if (!Number.isFinite(b) || b <= 0) return 0;
  return Math.floor(b / r);
}

export function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/**
 * Best-effort city/locality out of a Google-formatted address string, for a
 * compact location label (the create-campaign location dropdown) and as the
 * default city a batch campaign's location falls back to when the owner
 * hasn't picked one explicitly (see createBatch in
 * api/business/campaigns/route.js).
 *
 * A fixed "2nd comma segment" index used to be good enough for a plain
 * "street, city, state" address, but breaks the moment there's a floor/unit
 * prefix ("8th Floor, Unit No. 831, JMD Megapolis, Gurugram, Haryana,
 * India") — that picks "Unit No. 831", not the city. Anchoring from the END
 * instead is far more consistent: Indian addresses reliably close with
 * "…, City, State[ PIN], India" (or without the country), so the city is
 * whichever segment sits right before state/country, not a fixed position
 * from the front.
 */
// Shared by deriveCityFromAddress/deriveLocationLabel below — the trimmed,
// country-stripped comma segments an Indian Google address reliably ends
// with "…, [locality, ]City, State[ PIN][, India]".
function addressParts(address) {
  let parts = String(address || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1 && /^india$/i.test(parts[parts.length - 1])) parts = parts.slice(0, -1);
  return parts;
}

export function deriveCityFromAddress(address) {
  const parts = addressParts(address);
  if (parts.length <= 2) return parts[parts.length - 1] || "";
  // What's left ends in the state (optionally with a PIN code folded into
  // the same segment, e.g. "Haryana 122001") — the city is the segment
  // right before that.
  return parts[parts.length - 2];
}

/**
 * "Locality, City" (or just "City" when there's no locality segment to add,
 * or it's the same as the city) — for a location LABEL only, e.g. the
 * create/edit-campaign location dropdowns. Two locations can share a city
 * (two Gurugram branches) with nothing to tell them apart if the dropdown
 * only ever showed the city; the locality (the segment right before the
 * city — "Sector 23", "Koramangala", …) is what actually disambiguates
 * them. Campaign.city / reviewer city-matching still uses the plain city
 * alone (deriveCityFromAddress) — reviewers pick a city, not a locality, at
 * signup, so a locality has no meaning there.
 */
export function deriveLocationLabel(address) {
  const parts = addressParts(address);
  if (parts.length === 0) return "";
  if (parts.length <= 2) return parts[parts.length - 1];

  const city = parts[parts.length - 2];
  const locality = parts[parts.length - 3];
  if (!locality || locality.toLowerCase() === city.toLowerCase()) return city;
  return `${locality}, ${city}`;
}

// Common old/alternate spellings → the canonical name our own city list
// (lib/data/indiaStatesCities.js) uses. Google Places autocomplete (see
// components/business/CityMultiSelect.jsx) still happily returns the old
// name for several renamed Indian cities, while reviewers can only pick the
// canonical one at signup (PhoneOtpForm.jsx) — without this map the two
// would never string-match and a campaign silently never shows up for
// reviewers in that city. Keys are lowercase; extend as new mismatches turn up.
const CITY_ALIASES = {
  gurgaon: "Gurugram",
  bombay: "Mumbai",
  bangalore: "Bengaluru",
  calcutta: "Kolkata",
  madras: "Chennai",
  cochin: "Kochi",
  trivandrum: "Thiruvananthapuram",
  mysore: "Mysuru",
  poona: "Pune",
  baroda: "Vadodara",
  simla: "Shimla",
  allahabad: "Prayagraj",
  pondicherry: "Puducherry",
  vizag: "Visakhapatnam",
};

/**
 * Resolve a freely-typed/Google-Places city name to the canonical spelling
 * we standardize on, so a business picking "Gurgaon" and a reviewer set to
 * "Gurugram" still match (see campaignOpenToCity below). Falls through to
 * the input unchanged (just trimmed) when there's no known alias.
 */
export function canonicalizeCity(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  return CITY_ALIASES[trimmed.toLowerCase()] || trimmed;
}

/**
 * The effective list of cities a campaign is restricted to — `[]` means open
 * to any city. Resolves the new `cities` array (multi-city picker) against
 * the legacy single `city` field (still what batch/multi-location campaigns
 * write) so every caller checks exactly one thing instead of both fields
 * separately. `cities` wins when both are somehow set (it's the newer,
 * more-specific one); `city` is the fallback for campaigns created before
 * `cities` existed.
 */
export function campaignCities(campaign) {
  if (Array.isArray(campaign?.cities) && campaign.cities.length > 0) {
    return campaign.cities.map((c) => String(c).trim()).filter(Boolean);
  }
  return campaign?.city ? [String(campaign.city).trim()] : [];
}

/**
 * True if `reviewerCity` (case-insensitive) is allowed to see this campaign.
 * A reviewer with no declared city still sees every campaign — matches the
 * original single-city behavior, where an empty reviewer city never excluded
 * anything. In practice this never comes up: city is mandatory at reviewer
 * signup (PhoneOtpForm.jsx).
 */
export function campaignOpenToCity(campaign, reviewerCity) {
  const cities = campaignCities(campaign);
  if (cities.length === 0 || !reviewerCity) return true;
  const target = String(reviewerCity).trim().toLowerCase();
  return cities.some((c) => c.toLowerCase() === target);
}

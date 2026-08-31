/**
 * "Did this request come from the mobile app, or a browser?"
 *
 * There is no reliable way to INFER this — a User-Agent is trivially spoofed
 * and a WebView looks like a browser — so the app declares itself. It can do
 * that in any of four ways, checked in this order:
 *
 *   1. X-App-Platform: android      (or: ios)   — a header on every request.
 *   2. ?platform=android            (also ?app_platform= / ?app=) — the URL the
 *      app opens the site with. This is what a WebView build can do without
 *      touching every fetch: land once on a tagged URL and…
 *   3. …the `rl_platform` cookie src/proxy.js writes from that first tagged
 *      request, which keeps every later navigation in the same WebView
 *      recognised even though the query string is long gone.
 *   4. A User-Agent carrying the app's own marker ("RapportLook" /
 *      "com.rapportlook.app"), which is the usual one-line WebView
 *      customisation.
 *
 * Anything with none of those is treated as `web`. That default is the safe
 * one for the referral program (src/lib/referral.js): the reward is only paid
 * on an app install, so an unlabelled request never earns one by accident.
 *
 * ★ The flip side of that safe default is that a build which declares NONE of
 * the four looks exactly like the website, and a genuine install then reads as
 * "web only — no app yet". That is what /admin/referrals exists for: an admin
 * can approve the credit by hand when the automatic signal missed a real
 * install. Detection is a convenience here, never the last word.
 *
 * Honesty, not security: a determined person can send the header from curl.
 * It gates a ₹25 bonus that already requires passing phone-OTP on a real
 * number, so the cost of forging it is higher than the payout. If that ever
 * stops being true, the fix is Play Integrity / App Attest on the app side,
 * not a cleverer header.
 */
export const APP_PLATFORMS = ["android", "ios"];

export const PLATFORM_HEADER = "x-app-platform";

/** Written by src/proxy.js, read here — see the docblock above. */
export const PLATFORM_COOKIE = "rl_platform";

/** Query keys the app may open the site with, most explicit first. */
export const PLATFORM_QUERY_KEYS = ["platform", "app_platform", "app"];

// Only the app's own bundle id / product name counts. Deliberately NOT the
// generic Android WebView marker ("; wv"): every in-app browser (Facebook,
// Instagram, Gmail) is a WebView too, and crediting those as installs would
// pay the bonus to people who never left the website.
const UA_APP_MARKER = /rapportlook|com\.rapportlook\.app/i;
const UA_IOS = /iphone|ipad|ipod/i;

/** "android" | "ios" for anything recognisable, else null. */
function normalize(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return APP_PLATFORMS.includes(v) ? v : null;
}

function fromHeader(request) {
  return normalize(request?.headers?.get?.(PLATFORM_HEADER));
}

function fromQuery(request) {
  // NextRequest hands us a parsed URL; a plain Request only has the string.
  let url = request?.nextUrl ?? null;
  if (!url) {
    try {
      url = new URL(request?.url ?? "");
    } catch {
      return null;
    }
  }
  for (const key of PLATFORM_QUERY_KEYS) {
    const hit = normalize(url.searchParams?.get?.(key));
    if (hit) return hit;
  }
  return null;
}

function fromCookie(request) {
  const direct = request?.cookies?.get?.(PLATFORM_COOKIE)?.value;
  if (direct) return normalize(direct);
  // Route handlers get a plain Request in some call paths — parse the header
  // rather than requiring every caller to hand in a NextRequest.
  const header = request?.headers?.get?.("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${PLATFORM_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return normalize(decodeURIComponent(match[1]));
  } catch {
    return normalize(match[1]);
  }
}

function fromUserAgent(request) {
  const ua = request?.headers?.get?.("user-agent") ?? "";
  if (!UA_APP_MARKER.test(ua)) return null;
  return UA_IOS.test(ua) ? "ios" : "android";
}

/** "android" | "ios" | "web" — never null, so callers don't branch on absence. */
export function readClientPlatform(request) {
  return fromHeader(request) ?? fromQuery(request) ?? fromCookie(request) ?? fromUserAgent(request) ?? "web";
}

/**
 * The platform the request DECLARED explicitly (header or URL) — what
 * src/proxy.js persists into the cookie. Separate from readClientPlatform()
 * on purpose: re-writing the cookie from the cookie itself, or from a
 * guessed User-Agent, would turn a soft signal into a sticky one.
 */
export function readDeclaredPlatform(request) {
  return fromHeader(request) ?? fromQuery(request) ?? null;
}

/** True when the request came from the native app on either platform. */
export function isAppRequest(request) {
  return APP_PLATFORMS.includes(readClientPlatform(request));
}

/** True for a stored `signupSource` / platform string that means "the app". */
export function isAppPlatform(platform) {
  return APP_PLATFORMS.includes(String(platform || "").toLowerCase());
}

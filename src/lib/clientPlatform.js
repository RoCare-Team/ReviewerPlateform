/**
 * "Did this request come from the mobile app, or a browser?"
 *
 * There is no reliable way to infer this — a User-Agent is trivially spoofed
 * and a WebView looks like a browser — so the app declares itself with a
 * header on every request:
 *
 *     X-App-Platform: android      (or: ios)
 *
 * Anything without that header is treated as `web`. That default is the safe
 * one for the referral program (src/lib/referral.js): the reward is only paid
 * on an app install, so an unlabelled request never earns one by accident.
 *
 * Honesty, not security: a determined person can send the header from curl.
 * It gates a ₹25 bonus that already requires passing phone-OTP on a real
 * number, so the cost of forging it is higher than the payout. If that ever
 * stops being true, the fix is Play Integrity / App Attest on the app side,
 * not a cleverer header.
 */
export const APP_PLATFORMS = ["android", "ios"];

export const PLATFORM_HEADER = "x-app-platform";

/** "android" | "ios" | "web" — never null, so callers don't branch on absence. */
export function readClientPlatform(request) {
  const raw = request?.headers?.get?.(PLATFORM_HEADER) ?? "";
  const value = String(raw).trim().toLowerCase();
  return APP_PLATFORMS.includes(value) ? value : "web";
}

/** True when the request came from the native app on either platform. */
export function isAppRequest(request) {
  return APP_PLATFORMS.includes(readClientPlatform(request));
}

/** True for a stored `signupSource` / platform string that means "the app". */
export function isAppPlatform(platform) {
  return APP_PLATFORMS.includes(String(platform || "").toLowerCase());
}

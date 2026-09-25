import { userAgentFromString } from "next/server";
import { getAppVersionConfig } from "./appVersion";

/**
 * One shareable link that lands on the right app store.
 *
 * /download is the only URL anyone needs to post — an iPhone opening it goes
 * to the App Store, an Android phone to Play, and everything else (desktop,
 * a link-preview crawler) gets a page with both buttons. The alternative is
 * posting two links and asking people to pick, which is where installs get
 * lost.
 *
 * Worth being clear about what this is NOT: a true iOS Universal Link or
 * Android App Link, which open the ALREADY-INSTALLED app instead of the
 * browser. Those need /.well-known/apple-app-site-association and
 * /.well-known/assetlinks.json signed with the Apple Team ID and the Android
 * signing fingerprint, plus matching config in the app builds. This is the
 * store-routing half, which is what a "download" link is actually for.
 *
 * The store URLs are admin-editable (/admin/app-version → AppVersion), so a
 * changed listing or a new bundle id is a settings edit rather than a deploy.
 * The constants below are only the fallback for a fresh database.
 */
export const STORE_FALLBACK = {
  ios: "https://apps.apple.com/in/app/rapportlook/id6807688227",
  android: "https://play.google.com/store/apps/details?id=com.rapportlook.app",
};

/** Both store URLs, admin-configured where set. */
export async function getStoreLinks() {
  const cfg = await getAppVersionConfig();
  return {
    ios: cfg.ios.storeUrl || STORE_FALLBACK.ios,
    android: cfg.android.storeUrl || STORE_FALLBACK.android,
  };
}

/**
 * "ios" | "android" | null — null meaning "don't redirect, show the chooser".
 *
 * Bots get null on purpose: a crawler or a chat app fetching a link preview
 * must see the real page, not a 307 into the App Store. Without that, the
 * preview card in WhatsApp/Slack shows Apple's page instead of ours.
 */
export function platformFromUserAgent(ua) {
  const raw = String(ua || "");
  const parsed = userAgentFromString(raw || undefined);
  if (parsed.isBot) return null;

  const os = String(parsed.os?.name || "").toLowerCase();
  if (os === "ios") return "ios";
  if (os === "android") return "android";

  // ua-parser reports an iPad asking for the desktop site as "Mac OS", and a
  // few in-app browsers report an OS it doesn't know at all — fall back to the
  // markers that are in the string either way.
  if (/iphone|ipad|ipod/i.test(raw)) return "ios";
  if (/android/i.test(raw)) return "android";
  return null;
}

/**
 * The store URL to send this platform to, carrying a referral code when one
 * was on the link.
 *
 * Only Play can take the code with it: `referrer` is handed back to the app
 * through the Play Install Referrer API, so a fresh Android install can
 * pre-fill it with nothing typed (same shape lib/referral.js already builds).
 * The App Store has no equivalent, so an iOS invitee still types the code —
 * which is exactly what happens today, not a regression.
 */
export function storeUrlFor(platform, links, ref = "") {
  const url = links[platform];
  if (!url) return "";
  const code = String(ref || "").trim();
  if (platform !== "android" || !code) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}referrer=${encodeURIComponent(`ref=${code}`)}`;
}

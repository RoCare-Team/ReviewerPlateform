import dbConnect from "./db";
import AppVersion from "../models/AppVersion";

/**
 * The ONE place the mobile app's "are you up to date?" answer is computed.
 * Read by the public /api/app-version endpoint (what the app calls) and the
 * admin /api/admin/app-version endpoint (what sets it).
 */

export const PLATFORMS = ["android", "ios"];

export const APP_VERSION_DEFAULTS = {
  android: { latestVersion: "1.0.0", minSupportedVersion: "1.0.0", storeUrl: "" },
  ios: { latestVersion: "1.0.0", minSupportedVersion: "1.0.0", storeUrl: "" },
  forceUpdate: false,
  updateTitle: "Update available",
  updateMessage: "A new version of the app is available with the latest improvements.",
  forceTitle: "Update required",
  forceMessage: "This version is no longer supported. Please update to continue using the app.",
};

/**
 * "46.0.1" → [46, 0, 1]. Only the leading dotted-numeric run is read, so build
 * suffixes the stores allow ("2.1.0-beta3", "2.1.0+417") compare as their
 * release number instead of blowing up or sorting as text — where "10" would
 * otherwise come before "9".
 */
function versionParts(v) {
  const numeric = String(v ?? "").trim().match(/^\d+(?:\.\d+)*/)?.[0] ?? "0";
  return numeric.split(".").map((n) => Number(n) || 0);
}

/** -1 if a < b, 0 if equal, 1 if a > b. Missing segments count as 0 ("9" === "9.0"). */
export function compareVersions(a, b) {
  const x = versionParts(a);
  const y = versionParts(b);
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

function platformOut(doc, platform) {
  const p = doc?.[platform] ?? {};
  const d = APP_VERSION_DEFAULTS[platform];
  return {
    latestVersion: p.latestVersion || d.latestVersion,
    minSupportedVersion: p.minSupportedVersion || d.minSupportedVersion,
    storeUrl: p.storeUrl || "",
  };
}

/** The stored config, with every blank field resolved to its default. */
export async function getAppVersionConfig() {
  await dbConnect();
  const doc = await AppVersion.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global" } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    android: platformOut(doc, "android"),
    ios: platformOut(doc, "ios"),
    forceUpdate: Boolean(doc?.forceUpdate),
    updateTitle: doc?.updateTitle || APP_VERSION_DEFAULTS.updateTitle,
    updateMessage: doc?.updateMessage || APP_VERSION_DEFAULTS.updateMessage,
    forceTitle: doc?.forceTitle || APP_VERSION_DEFAULTS.forceTitle,
    forceMessage: doc?.forceMessage || APP_VERSION_DEFAULTS.forceMessage,
  };
}

export async function updateAppVersionConfig(patch) {
  await dbConnect();
  await AppVersion.findOneAndUpdate(
    { key: "global" },
    { $set: patch },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
  return getAppVersionConfig();
}

/**
 * The actual verdict for one client: given the platform it's running on and
 * the version it reports, should it show nothing, an optional update, or a
 * blocking one?
 *
 * `forceUpdate` is ALWAYS gated on the client actually being behind
 * `latestVersion`. Without that guard, flipping the emergency switch would
 * lock out the very people who already installed the fix — the modal would
 * tell them to update to the build they're on.
 *
 * A client that doesn't send its version gets `updateAvailable: false` rather
 * than a guess: an unknown version must never lock anyone out of the app.
 */
export function resolveUpdateState(config, platform, currentVersion) {
  const p = config[platform];
  const known = Boolean(String(currentVersion ?? "").trim());

  const behindLatest = known && compareVersions(currentVersion, p.latestVersion) < 0;
  const belowMinimum = known && compareVersions(currentVersion, p.minSupportedVersion) < 0;
  const forced = behindLatest && (config.forceUpdate || belowMinimum);

  return {
    platform,
    currentVersion: known ? String(currentVersion).trim() : "",
    latestVersion: p.latestVersion,
    minSupportedVersion: p.minSupportedVersion,
    // The two booleans the app actually branches on.
    updateAvailable: behindLatest,
    forceUpdate: forced,
    storeUrl: p.storeUrl,
    title: forced ? config.forceTitle : config.updateTitle,
    message: forced ? config.forceMessage : config.updateMessage,
  };
}

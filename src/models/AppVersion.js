import mongoose from "mongoose";

/**
 * Singleton mobile-app release info — what the CURRENT shipped build is on each
 * store, and what the OLDEST build we still allow is. Enforced by a fixed `key`,
 * same pattern as AppSettings.
 *
 * Two different levers, deliberately kept apart:
 *   - `latestVersion`        → anything below it gets an OPTIONAL "update available".
 *   - `minSupportedVersion`  → anything below it gets a BLOCKING "must update".
 *   - `forceUpdate`          → emergency switch: force EVERY out-of-date build,
 *                              without having to work out a version number first.
 *
 * The store URLs live here too so the app never hardcodes them — a changed
 * listing or a new bundle id is a settings edit, not an app release.
 */
const PlatformSchema = new mongoose.Schema(
  {
    latestVersion: { type: String, default: "1.0.0", trim: true },
    minSupportedVersion: { type: String, default: "1.0.0", trim: true },
    storeUrl: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const AppVersionSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },
    // Android's store URL is seeded with the live listing so the referral
    // link (lib/referral.js) works before anyone has opened the admin page —
    // a shared invite that 404s is worse than one pointing at a stale listing.
    android: {
      type: PlatformSchema,
      default: () => ({ storeUrl: "https://play.google.com/store/apps/details?id=com.rapportlook.app" }),
    },
    ios: { type: PlatformSchema, default: () => ({}) },
    // Emergency override — forces every build that isn't already on
    // `latestVersion`. Never forces someone who IS on the latest build; see
    // lib/appVersion.js#resolveUpdateState.
    forceUpdate: { type: Boolean, default: false },
    // Modal copy. Blank falls back to the defaults in lib/appVersion.js, so an
    // untouched install still shows something sensible.
    updateTitle: { type: String, default: "", trim: true },
    updateMessage: { type: String, default: "", trim: true },
    forceTitle: { type: String, default: "", trim: true },
    forceMessage: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.AppVersion || mongoose.model("AppVersion", AppVersionSchema);

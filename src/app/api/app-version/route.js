import { getAppVersionConfig, resolveUpdateState, PLATFORMS } from "../../../lib/appVersion";

/**
 * The mobile app's update check — called once at startup, before anything else.
 *
 *   GET /api/app-version?platform=android&version=45.0.0
 *
 * The SERVER decides; the app doesn't compare version strings itself. That's
 * the point of passing `version` — the app reads two booleans and renders:
 *
 *   forceUpdate: true       → blocking modal, no dismiss, only "Update"
 *   updateAvailable: true   → dismissible "update available" modal
 *   both false              → up to date, show nothing
 *
 * `storeUrl` is what the Update button opens, so a changed listing never needs
 * an app release. `title`/`message` are the modal copy, admin-editable.
 *
 * Both params are optional. Called bare (`GET /api/app-version`) it returns
 * just `config` — every platform's numbers — for a client that would rather
 * decide for itself. An unknown or missing `version` never forces an update.
 *
 * Deliberately unauthenticated: this runs before login, and on a build old
 * enough that its auth code may be exactly what's broken.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") || "").trim().toLowerCase();
  const version = searchParams.get("version") || searchParams.get("appVersion") || "";

  if (platform && !PLATFORMS.includes(platform)) {
    return Response.json(
      { error: `Unknown platform "${platform}". Use one of: ${PLATFORMS.join(", ")}.` },
      { status: 400 }
    );
  }

  const config = await getAppVersionConfig();
  const body = platform ? resolveUpdateState(config, platform, version) : {};

  return Response.json(
    { ok: true, ...body, config },
    {
      // Short cache only. An emergency force-update has to reach every device
      // within a minute, not sit on a CDN for an hour.
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    }
  );
}

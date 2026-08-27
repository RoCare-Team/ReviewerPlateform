import { z } from "zod";
import { getCurrentUser } from "../../../../lib/auth/session";
import { ROLES } from "../../../../lib/auth/roles";
import { getAppVersionConfig, updateAppVersionConfig, compareVersions } from "../../../../lib/appVersion";

/**
 * Admin-only control over the mobile app's update gate. Read by
 * /admin/app-version; the app itself reads the PUBLIC /api/app-version.
 */
async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN || user.status !== "active") {
    return { user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

// A store version like "46.0.1" / "9.0" / "2.1.0-beta3". Kept loose enough for
// the suffixes the stores allow, strict enough that a typo'd "v46" or an empty
// box can't quietly become "0" and un-gate every client.
const version = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)*([-+][0-9A-Za-z.-]+)?$/, "Use a version like 46.0.1");

const platform = z.object({
  latestVersion: version,
  minSupportedVersion: version,
  storeUrl: z.union([z.string().trim().url(), z.literal("")]),
});

const schema = z
  .object({
    android: platform,
    ios: platform,
    forceUpdate: z.boolean(),
    updateTitle: z.string().trim().max(120),
    updateMessage: z.string().trim().max(500),
    forceTitle: z.string().trim().max(120),
    forceMessage: z.string().trim().max(500),
  })
  .strict();

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;
  return Response.json(await getAppVersionConfig());
}

export async function PATCH(request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // A minimum above the latest build would demand an update to something
  // nobody can install yet. resolveUpdateState() refuses to force in that
  // case anyway, but it's a misconfiguration worth catching at the door
  // rather than silently doing nothing.
  for (const os of ["android", "ios"]) {
    const { latestVersion, minSupportedVersion } = parsed.data[os];
    if (compareVersions(minSupportedVersion, latestVersion) > 0) {
      return Response.json(
        { error: `${os === "ios" ? "iOS" : "Android"}: minimum supported version can't be newer than the latest version.` },
        { status: 400 }
      );
    }
  }

  const config = await updateAppVersionConfig(parsed.data);
  return Response.json({ ok: true, config });
}

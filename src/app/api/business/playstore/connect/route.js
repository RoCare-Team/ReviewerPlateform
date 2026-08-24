import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { can } from "../../../../../lib/auth/permissions";
import { buildAuthUrl, signState, isConfigured } from "../../../../../lib/playstore";

/**
 * Start the Play Store OAuth flow. Browser navigation (a link/button hits
 * this), so it redirects rather than returning JSON. Requires
 * connection:playstore:manage.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login");
  if (!can(user, "connection:playstore:manage")) redirect("/login");

  if (!isConfigured()) {
    redirect("/business/connections?playstore=not_configured");
  }

  const state = signState(user.id);
  redirect(buildAuthUrl(state));
}

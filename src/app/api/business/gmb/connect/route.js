import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { can } from "../../../../../lib/auth/permissions";
import { buildAuthUrl, signState, isConfigured } from "../../../../../lib/gmb";

/**
 * Start the Google Business Profile OAuth flow. Browser navigation (a link/button
 * hits this), so it redirects rather than returning JSON. Requires the business
 * owner permission connection:google:manage.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login");
  if (!can(user, "connection:google:manage")) redirect("/login");

  if (!isConfigured()) {
    redirect("/business/connections?gmb=not_configured");
  }

  const state = signState(user.id);
  redirect(buildAuthUrl(state));
}

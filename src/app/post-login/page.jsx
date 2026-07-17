import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth/session";
import { homeFor } from "../../lib/auth/roles";

/**
 * Single landing point after any successful sign-in.
 *
 * The destination is derived from the session role SERVER-side. The client never
 * chooses where it lands, so a tampered client can't route itself into /admin —
 * and even if it navigated there directly, the admin layout's requireAdmin()
 * would reject it.
 */
export default async function PostLoginPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(homeFor(user.role));
}

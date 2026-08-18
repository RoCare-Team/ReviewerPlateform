import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth/session";
import dbConnect from "../../../../../lib/db";
import ImpersonationLog from "../../../../../models/ImpersonationLog";
import { restoreAdminCookies, IMPERSONATOR_COOKIE_NAME } from "../../../../../lib/auth/impersonation";

/**
 * "Return to admin" — ends the current impersonated session and restores the
 * admin's own. Runs AS the impersonated user (that's the whole point), so
 * this checks for the stashed admin cookie rather than requiring admin role.
 *
 * Writes via the returned NextResponse's own cookie jar — see the comment in
 * impersonate/[userId]/route.js for why that matters over next/headers here.
 */
export async function POST(request) {
  const adminSessionToken = request.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value;

  if (!adminSessionToken) {
    return NextResponse.json({ error: "Not currently impersonating." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (user) {
    await dbConnect();
    await ImpersonationLog.findOneAndUpdate(
      { targetUser: user.id, endedAt: null },
      { $set: { endedAt: new Date() } },
      { sort: { startedAt: -1 } }
    );
  }

  const res = NextResponse.json({ ok: true, redirect: "/admin" });
  restoreAdminCookies(res.cookies, adminSessionToken);
  return res;
}

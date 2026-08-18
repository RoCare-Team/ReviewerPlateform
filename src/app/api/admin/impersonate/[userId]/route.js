import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { ROLES, homeFor } from "../../../../../lib/auth/roles";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import ImpersonationLog from "../../../../../models/ImpersonationLog";
import {
  canImpersonate,
  encodeImpersonationToken,
  applyImpersonationCookies,
  resolveImpersonationAuthority,
} from "../../../../../lib/auth/impersonation";

/**
 * Admin "log in as" this user. Swaps the admin's session cookie for a
 * freshly minted one scoped to the target account (see lib/auth/impersonation.js
 * for why this doesn't need a re-login), stashes the admin's own session so
 * "Return to admin" can restore it, and logs the event.
 *
 * Authorization goes through resolveImpersonationAuthority() rather than a
 * flat "must be admin right now" check — an admin chaining a second "Login
 * as" from a tab that's still showing the (stale) admin UI no longer has an
 * admin session cookie at that point (the first impersonation already
 * flipped it), so a flat check would wrongly 401 it. See that function's
 * comment for the full reasoning.
 *
 * Cookies are written on the returned NextResponse itself (response.cookies),
 * not via next/headers' cookies() — that jar is meant for reading in Route
 * Handlers and writes from it aren't reliably attached to a POST's JSON
 * response, which was silently dropping the Set-Cookie header.
 */
export async function POST(request, { params }) {
  const sessionUser = await getCurrentUser();
  const currentAdmin =
    sessionUser?.role === ROLES.ADMIN && sessionUser.status === "active" ? sessionUser : null;

  const authority = await resolveImpersonationAuthority(request, currentAdmin);
  if (!authority || !authority.stashToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  await dbConnect();
  const target = await User.findById(userId).select("name email role status phone");

  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (!canImpersonate(target)) {
    const reason = target.role === "admin" ? "Can't impersonate another admin." : "Only active accounts can be impersonated.";
    return NextResponse.json({ error: reason }, { status: 403 });
  }

  const newToken = await encodeImpersonationToken(target, authority.admin);

  await ImpersonationLog.create({
    admin: authority.admin.id,
    adminEmail: authority.admin.email,
    targetUser: target._id,
    targetEmail: target.email || "",
    targetPhone: target.phone || "",
    targetRole: target.role,
  });

  const res = NextResponse.json({ ok: true, redirect: homeFor(target.role) });
  applyImpersonationCookies(res.cookies, authority.stashToken, newToken);
  return res;
}

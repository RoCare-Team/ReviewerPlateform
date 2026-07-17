"use client";

import { useSession } from "next-auth/react";
import { can } from "../../lib/auth/permissions";

/**
 * ⚠️ COSMETIC ONLY. This is UX, not security.
 *
 * It hides a button the user can't use. It does NOT protect anything: the markup
 * ships to the browser, the session is client-readable, and anyone can call the
 * endpoint behind the button directly with curl.
 *
 * The real checks are:
 *   - the protected layout, via requireRole()/requirePermission() in lib/auth/guards
 *   - the API route itself, via apiRequirePermission()
 *
 * If a thing is hidden by RoleGate and nowhere else, it is not protected.
 * Never let this be the only check.
 */
export default function RoleGate({ role, roles, permission, children, fallback = null }) {
  const { data: session, status } = useSession();

  if (status === "loading") return fallback;
  const user = session?.user;
  if (!user) return fallback;

  if (role && user.role !== role) return fallback;
  if (roles && !roles.includes(user.role)) return fallback;
  if (permission && !can(user, permission)) return fallback;

  return children;
}

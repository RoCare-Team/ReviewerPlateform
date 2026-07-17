import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import { can } from "./permissions";
import { homeFor, ROLES } from "./roles";

/**
 * These are the AUTHORITY. Middleware is a fast reject that runs before the
 * request; it is not a gate you can rely on (it can be bypassed by direct
 * invocation paths, and Next's own docs say not to use it as the session
 * authority). Every protected layout calls one of these, and every protected
 * API route checks again.
 */

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/login?e=inactive");
  return user;
}

export async function requireRole(role) {
  const user = await requireAuth();
  if (user.role !== role) {
    // Send them to their own home, not to a 403 — a 403 confirms the route
    // exists and that they're simply the wrong role.
    redirect(homeFor(user.role));
  }
  return user;
}

export async function requireAnyRole(roles) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function requirePermission(action) {
  const user = await requireAuth();
  if (!can(user, action)) redirect(homeFor(user.role));
  return user;
}

/** Admin has its own login surface, so it redirects there rather than to /login. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN) redirect("/admin/login");
  if (user.status !== "active") redirect("/admin/login?e=inactive");
  return user;
}

/* ---- API-route variants: return a Response instead of redirecting ---- */

export async function apiRequireAuth() {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") {
    return { user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function apiRequirePermission(action) {
  const { user, response } = await apiRequireAuth();
  if (response) return { user: null, response };
  if (!can(user, action)) {
    return { user: null, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, response: null };
}

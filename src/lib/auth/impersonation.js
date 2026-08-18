import { encode, decode } from "next-auth/jwt";
import { ROLES, sessionMaxAge } from "./roles";

/**
 * Admin "log in as" a business owner or reviewer — support/debugging tool so
 * an admin can see and act on exactly what that user sees, without needing
 * their password/OTP.
 *
 * How it works: Auth.js v5's JWT session is just an encrypted cookie, salted
 * with the cookie's own name (see proxy.js's comment on this). We can mint a
 * new one for the target user with the SAME `encode()` Auth.js itself uses,
 * swap it in as the session cookie, and stash the admin's original session
 * token in a second httpOnly cookie so "Return to admin" can restore it
 * byte-for-byte — no re-login needed, and no separate admin-session store.
 *
 * Constraints deliberately baked in here (not just at the call site):
 *  - Never an admin target — impersonating another admin is a privilege
 *    escalation path this tool must not open.
 *  - Capped at 2h regardless of the role's normal session length — an admin
 *    who forgets to "Return to admin" doesn't stay logged in as that user
 *    indefinitely.
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token";
export const IMPERSONATOR_COOKIE_NAME = "rh_impersonator_token";
export const MAX_IMPERSONATION_SECONDS = 2 * 60 * 60; // 2h

export function canImpersonate(targetUser) {
  return Boolean(targetUser) && targetUser.role !== ROLES.ADMIN && targetUser.status === "active";
}

/** Mints a session JWT for `targetUser`, tagged with who's really behind it. */
export async function encodeImpersonationToken(targetUser, admin) {
  return encode({
    secret: process.env.AUTH_SECRET,
    salt: SESSION_COOKIE_NAME,
    maxAge: MAX_IMPERSONATION_SECONDS,
    token: {
      id: String(targetUser._id),
      sub: String(targetUser._id),
      role: targetUser.role,
      status: targetUser.status,
      name: targetUser.name || undefined,
      email: targetUser.email || undefined,
      ...(targetUser.phone ? { phone: targetUser.phone } : {}),
      // Marks this session as borrowed — the session() callback in
      // lib/auth/config.js forwards this onto session.user so the UI can show
      // an "impersonating" banner, and it's the audit trail for who acted.
      impersonatedBy: String(admin.id),
      impersonatedByEmail: admin.email,
      exp: Math.floor(Date.now() / 1000) + MAX_IMPERSONATION_SECONDS,
    },
  });
}

/**
 * Who's allowed to start (another) impersonation right now, in THIS browser
 * cookie jar. Two cases:
 *
 *  1. Genuinely logged in as admin (`session.role === "admin"`) — the normal,
 *     first-ever "Login as" from the admin panel.
 *  2. Already impersonating someone (the session cookie is a target user's,
 *     not the admin's) but the ORIGINAL admin token is still sitting in the
 *     stash cookie — an admin clicking "Login as" a second time from a tab
 *     that's still showing the (now stale) admin UI. Without this branch
 *     that second click 401s, because the browser's *shared* session cookie
 *     already flipped to the first target user the moment impersonation #1
 *     happened (cookies aren't scoped per tab — no browser API for that).
 *
 * Either way, the token that must survive as the stash is the REAL admin
 * token — never the intermediate target-user one — so chaining "Login as" N
 * times in a row still restores the actual admin with one "Return to admin".
 */
export async function resolveImpersonationAuthority(request, currentAdmin) {
  if (currentAdmin) {
    // Real admin session right now — this token becomes the new stash.
    return { admin: currentAdmin, stashToken: request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null };
  }

  const stashed = request.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value;
  if (!stashed) return null;

  const payload = await decode({ token: stashed, secret: process.env.AUTH_SECRET, salt: SESSION_COOKIE_NAME }).catch(
    () => null
  );
  if (!payload || payload.role !== ROLES.ADMIN || payload.status !== "active") return null;

  return {
    admin: { id: payload.id, email: payload.email },
    stashToken: stashed, // unchanged — already the real admin token
  };
}

const cookieOpts = (maxAge) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

// Auth.js splits the session cookie into `<name>.0`, `<name>.1`, ... when the
// JWT is too large for one cookie (SessionStore.chunk — see @auth/core). Our
// tokens never get that big, but the ADMIN's original one (set by real Auth.js
// sign-in) hypothetically could. Clearing a fixed range of chunk names is
// cheap insurance: leaving a stale chunk behind would get concatenated onto
// whatever we write next and corrupt it, decrypting to nothing — which reads
// as "logged out" rather than a clear error.
const MAX_CHUNKS = 4;
function clearChunks(jar) {
  for (let i = 0; i < MAX_CHUNKS; i++) jar.delete(`${SESSION_COOKIE_NAME}.${i}`);
}

/** Swaps the session cookie to `newToken`, preserving the current one for restore. */
export function applyImpersonationCookies(jar, currentSessionToken, newToken) {
  jar.set(IMPERSONATOR_COOKIE_NAME, currentSessionToken, cookieOpts(MAX_IMPERSONATION_SECONDS));
  clearChunks(jar);
  jar.set(SESSION_COOKIE_NAME, newToken, cookieOpts(MAX_IMPERSONATION_SECONDS));
}

/** Restores the admin's original session cookie and clears the stash. */
export function restoreAdminCookies(jar, adminSessionToken) {
  clearChunks(jar);
  jar.set(SESSION_COOKIE_NAME, adminSessionToken, cookieOpts(sessionMaxAge(ROLES.ADMIN)));
  jar.delete(IMPERSONATOR_COOKIE_NAME);
}

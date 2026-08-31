import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ROLES } from "./lib/auth/roles";
import { PLATFORM_COOKIE, readDeclaredPlatform } from "./lib/clientPlatform";

/**
 * COARSE ROUTING ONLY. This is a fast reject, not the authority.
 *
 * Every protected layout calls requireRole()/requireAdmin(), and every protected
 * API route checks again. Next's own auth guide is explicit that this layer must
 * not be your session or authorization solution — it does an optimistic check on
 * the JWT and nothing more. It never touches the database.
 *
 * `proxy.js` (renamed from `middleware.js` — the old convention is deprecated
 * as of Next 16, see https://nextjs.org/docs/messages/middleware-to-proxy).
 * Proxy now defaults to the Node.js runtime, which is stable since 15.5 and
 * is exactly what getToken() needs — no edge-runtime tradeoff to preserve
 * here anymore.
 */

const ROLE_PREFIX = [
  { prefix: "/admin", role: ROLES.ADMIN, signIn: "/admin/login" },
  { prefix: "/business", role: ROLES.BUSINESS_OWNER, signIn: "/login" },
  { prefix: "/reviewer", role: ROLES.REVIEWER, signIn: "/login" },
];

const HOME = {
  [ROLES.ADMIN]: "/admin",
  [ROLES.BUSINESS_OWNER]: "/business",
  [ROLES.REVIEWER]: "/reviewer",
};

// Public auth surfaces. An already-authenticated user gets bounced to their
// home. No /signup here — it no longer exists as a page (next.config.mjs
// 301-redirects it to /login, which handles both login and signup inline).
const AUTH_PAGES = ["/login", "/verify-otp", "/forgot-password", "/reset-password"];

/**
 * Second, unrelated job (see lib/clientPlatform.js): remember that this
 * browser is the mobile app.
 *
 * A WebView build can tag the URL it opens (`?platform=android`) or send the
 * X-App-Platform header, but the query string is gone by the second
 * navigation and a WebView adds no headers to page loads. So the first
 * request that declares itself gets a year-long cookie, and everything after
 * it — page loads, form posts, API calls — reads as the app. Without it an
 * install can sign up, type a referral code, and still be recorded as a
 * WEBSITE signup, which is exactly the case that leaves a referrer unpaid.
 *
 * Applied to whatever response the routing below produced, redirects
 * included, so the tag survives the login bounce.
 */
function tagPlatform(request, response) {
  const declared = readDeclaredPlatform(request);
  if (!declared) return response;
  if (request.cookies?.get?.(PLATFORM_COOKIE)?.value === declared) return response;

  response.cookies.set(PLATFORM_COOKIE, declared, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function proxy(request) {
  return tagPlatform(request, await route(request));
}

async function route(request) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // Auth.js v5 salts the JWT with the cookie name; it differs on HTTPS.
    secureCookie: process.env.NODE_ENV === "production",
    cookieName:
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
  });

  // /admin/login is public — exclude it before the /admin role check below.
  if (pathname === "/admin/login") {
    if (token?.role === ROLES.ADMIN) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (token?.role && HOME[token.role]) {
      return NextResponse.redirect(new URL(HOME[token.role], request.url));
    }
    return NextResponse.next();
  }

  const match = ROLE_PREFIX.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  );
  if (!match) return NextResponse.next();

  if (!token) {
    const url = new URL(match.signIn, request.url);
    // Preserve intent so login can bounce back. Path only — never an absolute
    // URL from the request, which would make this an open redirect.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (token.role !== match.role) {
    return NextResponse.redirect(new URL(HOME[token.role] ?? "/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * Everything except Next internals, the auth API (which must stay reachable
     * to issue sessions), and static files.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

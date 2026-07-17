import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ROLES } from "./lib/auth/roles";

/**
 * COARSE ROUTING ONLY. This is a fast reject, not the authority.
 *
 * Every protected layout calls requireRole()/requireAdmin(), and every protected
 * API route checks again. Next's own auth guide is explicit that this layer must
 * not be your session or authorization solution — it does an optimistic check on
 * the JWT and nothing more. It never touches the database.
 *
 * Note: this file is `middleware.js`, not Next 16's newer `proxy.js`, on purpose.
 * `proxy` forces the nodejs runtime; `middleware` keeps the edge runtime, which
 * is what getToken() below is built for. Renaming this file without also moving
 * the token read would regress that.
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

// Public auth surfaces. An already-authenticated user gets bounced to their home.
const AUTH_PAGES = ["/login", "/signup", "/verify-otp", "/forgot-password", "/reset-password"];

export async function middleware(request) {
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

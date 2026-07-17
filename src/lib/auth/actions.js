"use server";

import { cookies } from "next/headers";
import { SIGNUP_ROLE_COOKIE } from "./config";
import { canSelfSignup } from "./roles";

/**
 * Records which signup page the user came from, so the Google callback knows
 * whether to create a reviewer or a business_owner.
 *
 * This is signup INTENT, not authority. It is validated here AND again in
 * config.js against roles.json, where admin is signup:"closed" — so a forged
 * cookie value of "admin" is rejected at both ends and can only ever produce
 * "choose a role". The cookie is httpOnly so page scripts can't read or set it,
 * and short-lived because it's only meant to survive one OAuth round-trip.
 */
export async function setSignupIntent(role) {
  if (!canSelfSignup(role)) return { ok: false };

  const jar = await cookies();
  jar.set(SIGNUP_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax", // must survive the redirect back from Google
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return { ok: true };
}

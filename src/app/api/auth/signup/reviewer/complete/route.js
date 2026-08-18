import { z } from "zod";
import { completePhoneSignup, isValidPhone } from "../../../../../../lib/auth/phoneAuth";
import { ROLES } from "../../../../../../lib/auth/roles";

/**
 * Final step of reviewer signup — only reached for a phone that had NO
 * account at OTP-verify time (see /api/auth/otp/phone/verify's
 * `status: "new"`). Body: { phone, name, verifiedToken, city }. Role is
 * fixed by this route, never the body — mirrors
 * /api/auth/signup/business/complete.
 *
 * `city` is mandatory here (unlike the business route, which doesn't take
 * one) — campaigns are matched to reviewers by city (see
 * reviewer/campaigns/page.jsx and Campaign.city), so a reviewer account
 * can't exist without one. This replaces the old post-login mandatory
 * browser-geolocation capture (LocationGate) with a one-time declaration
 * at signup.
 */
const schema = z
  .object({
    phone: z.string().trim(),
    name: z.string().trim().min(1, "Name is required").max(100),
    verifiedToken: z.string().min(1),
    city: z.string().trim().min(1, "City is required").max(120),
    // Optional — auto-filled from a `?ref=` link or typed in manually. See
    // lib/referral.js; an invalid code is simply ignored, never an error.
    referralCode: z.string().trim().max(20).optional(),
  })
  .strict();

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return Response.json({ error: parsed.error?.issues?.[0]?.message || "Invalid input" }, { status: 400 });
  }

  const result = await completePhoneSignup({ ...parsed.data, role: ROLES.REVIEWER });
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code, role: result.role }, { status: 400 });
  }

  return Response.json({ ok: true, otpToken: result.otpToken });
}

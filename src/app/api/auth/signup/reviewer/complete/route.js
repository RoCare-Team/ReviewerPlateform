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
 *
 * `ageConfirmed` is mandatory too — a self-declared "I'm 18 or older"
 * checkbox, not a verified date of birth. Reviewers post real reviews on
 * real platforms under their own participation, so this is a genuine
 * eligibility rule, checked here AND re-checked in completePhoneSignup()
 * (the actual account-creation gate).
 */
const schema = z
  .object({
    phone: z.string().trim(),
    name: z.string().trim().min(1, "Name is required").max(100),
    verifiedToken: z.string().min(1),
    city: z.string().trim().min(1, "City is required").max(120),
    ageConfirmed: z.boolean(),
    // Optional — auto-filled from a `?ref=` link or typed in manually. See
    // lib/referral.js; an invalid code is simply ignored, never an error.
    referralCode: z.string().trim().max(20).optional(),
  })
  .strict()
  .refine((v) => v.ageConfirmed === true, {
    message: "You are not eligible for review — you must be 18 or older.",
    path: ["ageConfirmed"],
  });

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

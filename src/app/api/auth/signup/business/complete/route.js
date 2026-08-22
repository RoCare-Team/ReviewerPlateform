import { z } from "zod";
import { completePhoneSignup, isValidPhone } from "../../../../../../lib/auth/phoneAuth";
import { ROLES } from "../../../../../../lib/auth/roles";

/**
 * Final step of business signup — only reached for a phone that had NO
 * account at OTP-verify time (see /api/auth/otp/phone/verify's
 * `status: "new"`). Body: { phone, name, verifiedToken }. Role is fixed by
 * this route, never the body — same discipline as lib/auth/signup.js.
 */
const schema = z
  .object({
    phone: z.string().trim(),
    name: z.string().trim().min(1, "Name is required").max(100),
    verifiedToken: z.string().min(1),
    // Optional — auto-filled from a `?ref=` link or typed in manually. See
    // lib/referral.js; an invalid code is simply ignored, never an error.
    referralCode: z.string().trim().max(20).optional(),
  })
  .strict();

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await completePhoneSignup({ ...parsed.data, role: ROLES.BUSINESS_OWNER });
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code, role: result.role }, { status: 400 });
  }

  return Response.json({ ok: true, otpToken: result.otpToken });
}

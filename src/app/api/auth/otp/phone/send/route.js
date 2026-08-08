import { z } from "zod";
import { requestPhoneOtp, isValidPhone } from "../../../../../../lib/auth/phoneAuth";
import { ROLES } from "../../../../../../lib/auth/roles";

/**
 * Step 1 of phone+OTP login/signup (both share this — see
 * /api/auth/otp/phone/verify for login and /api/auth/signup/{business,reviewer}/complete
 * for signup). Body: { phone, intent?, role? } — 10 digits, no country code.
 *
 * `intent: "signup"` + `role` lets requestPhoneOtp() reject a cross-role
 * number (already registered under the OTHER role) BEFORE an OTP is sent —
 * no point texting a code for a signup that's certain to be rejected once
 * verified.
 */
const schema = z
  .object({
    phone: z.string().trim(),
    intent: z.enum(["login", "signup"]).default("login"),
    role: z.enum([ROLES.BUSINESS_OWNER, ROLES.REVIEWER]).optional(),
  })
  .strict();

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return Response.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  const { phone, intent, role } = parsed.data;
  const result = await requestPhoneOtp(phone, { intent, role }, request);
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code, role: result.role }, { status: 400 });
  }

  return Response.json({ ok: true, message: result.message });
}

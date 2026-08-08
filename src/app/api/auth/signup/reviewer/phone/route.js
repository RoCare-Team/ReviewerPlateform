import { z } from "zod";
import { verifyPhoneOtpForSignup, isValidPhone } from "../../../../../../lib/auth/phoneAuth";
import { ROLES } from "../../../../../../lib/auth/roles";

/**
 * Step 2 of phone+OTP SIGNUP for reviewers. Role is fixed by this route,
 * never read from the body — mirrors /api/auth/signup/business/phone.
 * Body: { phone, otp, name }.
 */
const schema = z
  .object({
    phone: z.string().trim(),
    otp: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code"),
    name: z.string().trim().min(1, "Name is required").max(100),
  })
  .strict();

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await verifyPhoneOtpForSignup(
    { ...parsed.data, role: ROLES.REVIEWER },
    request
  );
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code, role: result.role }, { status: 400 });
  }

  return Response.json({ ok: true, otpToken: result.otpToken });
}

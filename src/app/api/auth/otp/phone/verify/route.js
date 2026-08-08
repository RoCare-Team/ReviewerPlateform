import { z } from "zod";
import { verifyPhoneOtpForLogin, isValidPhone } from "../../../../../../lib/auth/phoneAuth";

/**
 * Step 2 of phone+OTP LOGIN (existing accounts only — role-agnostic, shared
 * by reviewer and business_owner). Signup has its own routes
 * (/api/auth/signup/{business,reviewer}/phone) since account creation needs
 * a role, which must come from the route, not this body.
 *
 * Body: { phone, otp }. On success returns a one-shot `otpToken` the client
 * redeems via `signIn("phone-otp", { phone, otpToken })` to establish the
 * real session — see src/lib/auth/providers/phoneOtp.js.
 */
const schema = z
  .object({
    phone: z.string().trim(),
    otp: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code"),
  })
  .strict();

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await verifyPhoneOtpForLogin(parsed.data.phone, parsed.data.otp, request);
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code }, { status: 400 });
  }

  return Response.json({ ok: true, otpToken: result.otpToken });
}

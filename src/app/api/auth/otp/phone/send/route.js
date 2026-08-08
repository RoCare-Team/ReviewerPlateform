import { z } from "zod";
import { requestPhoneOtp, isValidPhone } from "../../../../../../lib/auth/phoneAuth";

/**
 * Step 1 of phone+OTP login/signup (both share this — see
 * /api/auth/otp/phone/verify for login and /api/auth/signup/{business,reviewer}/phone
 * for signup). Body: { phone } — 10 digits, no country code.
 */
const schema = z.object({ phone: z.string().trim() }).strict();

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return Response.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  const result = await requestPhoneOtp(parsed.data.phone, request);
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });

  return Response.json({ ok: true, message: result.message });
}
